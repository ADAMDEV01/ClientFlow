import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: authMock }));

import { getPrisma } from "@/lib/prisma";
import { requireClientProjectAccess, requireRole } from "@/server/authz";
import { decideDeliverable, submitDeliverable } from "@/server/services/deliverable-service";
import { consumeRateLimit } from "@/server/services/rate-limit";
import { changeMemberRole } from "@/server/services/project-management-service";
import { deleteProjectAction, changeMemberRoleAction, removeWorkspaceMemberAction } from "@/app/actions/project-management-actions";
import { createInvitationAction } from "@/app/actions/invitation-actions";

const prisma = getPrisma();
const suffix = "it-" + process.pid + "-" + Date.now();
const roles = ["OWNER", "ADMIN", "MEMBER", "CLIENT"] as const;
type TestRole = (typeof roles)[number];
const users = new Map<TestRole, string>();
const workspaceIds: string[] = [];
let workspaceId = "";
let otherWorkspaceId = "";
let clientId = "";
let projectId = "";

async function createUser(role: TestRole) {
  const user = await prisma.user.create({
    data: {
      name: role + " integration user",
      email: role.toLowerCase() + "-" + suffix + "@example.test",
      passwordHash: "integration-test-only-not-a-real-password-hash",
    },
    select: { id: true },
  });
  users.set(role, user.id);
  return user.id;
}

beforeAll(async () => {
  const ownerId = await createUser("OWNER");
  const adminId = await createUser("ADMIN");
  const memberId = await createUser("MEMBER");
  const clientUserId = await createUser("CLIENT");

  const workspace = await prisma.workspace.create({
    data: {
      name: "Integration Workspace",
      slug: "integration-" + suffix,
      ownerId,
      members: {
        create: [
          { userId: ownerId, role: "OWNER" },
          { userId: adminId, role: "ADMIN" },
          { userId: memberId, role: "MEMBER" },
        ],
      },
    },
    select: { id: true },
  });
  workspaceId = workspace.id;
  workspaceIds.push(workspace.id);

  const otherWorkspace = await prisma.workspace.create({
    data: {
      name: "Other Integration Workspace",
      slug: "other-integration-" + suffix,
      ownerId,
      members: { create: { userId: ownerId, role: "OWNER" } },
    },
    select: { id: true },
  });
  otherWorkspaceId = otherWorkspace.id;
  workspaceIds.push(otherWorkspace.id);

  const client = await prisma.client.create({
    data: {
      workspaceId,
      userId: clientUserId,
      name: "Integration Client",
      email: "portal-" + suffix + "@example.test",
    },
    select: { id: true },
  });
  clientId = client.id;

  const project = await prisma.project.create({
    data: { workspaceId, clientId, name: "Integration Project" },
    select: { id: true },
  });
  projectId = project.id;
});

afterAll(async () => {
  if (workspaceId) {
    await prisma.review.deleteMany({ where: { workspaceId } });
    await prisma.deliverableComment.deleteMany({ where: { workspaceId } });
  }
  await prisma.rateLimitBucket.deleteMany({ where: { key: "integration-rate-limit:" + suffix } });
  await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [...users.values()] } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PostgreSQL authorization matrix", () => {
  const actions = [
    { name: "read workspace data", allowed: ["OWNER", "ADMIN", "MEMBER"] },
    { name: "create and update project data", allowed: ["OWNER", "ADMIN", "MEMBER"] },
    { name: "invite a client portal user", allowed: ["OWNER", "ADMIN"] },
    { name: "delete workspace records", allowed: ["OWNER", "ADMIN"] },
    { name: "manage workspace roles", allowed: ["OWNER"] },
    { name: "upload and submit deliverables", allowed: ["OWNER", "ADMIN", "MEMBER"] },
    { name: "review client deliverables", allowed: ["CLIENT"], clientAction: true },
  ] as const;

  it.each(roles.flatMap((role) =>
    actions.map((action) => ({
      role,
      action: action.name,
      allowed: (action.allowed as readonly string[]).includes(role),
      rolesAllowed: action.allowed.filter((candidate) => candidate !== "CLIENT") as readonly ("OWNER" | "ADMIN" | "MEMBER")[],
      clientAction: "clientAction" in action && action.clientAction === true,
    })),
  ))("$role: $action => allowed=$allowed", async ({ role, allowed, rolesAllowed, clientAction }) => {
    authMock.mockResolvedValue({
      user: { id: users.get(role), role, clientId: role === "CLIENT" ? clientId : null },
    });

    if (clientAction) {
      if (allowed) {
        await expect(requireClientProjectAccess(workspaceId, projectId)).resolves.toMatchObject({
          project: { id: projectId, workspaceId, clientId },
        });
      } else {
        await expect(requireClientProjectAccess(workspaceId, projectId)).rejects.toMatchObject({
          code: "CLIENT_ACCESS_DENIED",
        });
      }
      return;
    }

    if (role === "CLIENT") {
      await expect(requireRole(workspaceId, rolesAllowed)).rejects.toMatchObject({
        code: "WORKSPACE_ACCESS_DENIED",
      });
      return;
    }

    if (allowed) {
      await expect(requireRole(workspaceId, rolesAllowed)).resolves.toMatchObject({
        membership: { role },
      });
    } else {
      await expect(requireRole(workspaceId, rolesAllowed)).rejects.toMatchObject({
        code: "ROLE_FORBIDDEN",
      });
    }
  });

  it.each(roles)("%s: only the linked client can access the client project", async (role) => {
    authMock.mockResolvedValue({
      user: { id: users.get(role), role, clientId: role === "CLIENT" ? clientId : null },
    });

    if (role === "CLIENT") {
      await expect(requireClientProjectAccess(workspaceId, projectId)).resolves.toMatchObject({
        project: { id: projectId, workspaceId, clientId },
      });
    } else {
      await expect(requireClientProjectAccess(workspaceId, projectId)).rejects.toMatchObject({
        code: "CLIENT_ACCESS_DENIED",
      });
    }
  });

  it("blocks a valid member from a different workspace", async () => {
    authMock.mockResolvedValue({ user: { id: users.get("ADMIN"), role: "ADMIN" } });
    await expect(requireRole(otherWorkspaceId, ["OWNER", "ADMIN", "MEMBER"])).rejects.toMatchObject({
      code: "WORKSPACE_ACCESS_DENIED",
    });
  });

  it("does not expose a project belonging to another workspace or client", async () => {
    authMock.mockResolvedValue({
      user: { id: users.get("CLIENT"), role: "CLIENT", clientId },
    });
    await expect(requireClientProjectAccess(otherWorkspaceId, projectId)).rejects.toMatchObject({
      code: "CLIENT_ACCESS_DENIED",
    });
  });
});


describe("server action authorization matrix", () => {
  it.each(roles)("deleteProjectAction enforces the persisted role for %s", async (role) => {
    authMock.mockResolvedValue({
      user: { id: users.get(role), role, clientId: role === "CLIENT" ? clientId : null },
    });
    const project = await prisma.project.create({
      data: { workspaceId, clientId, name: "Action delete " + role + " " + suffix },
      select: { id: true },
    });

    const result = await deleteProjectAction(workspaceId, project.id);
    const allowed = role === "OWNER" || role === "ADMIN";
    expect(result.ok).toBe(allowed);
    const remaining = await prisma.project.findUnique({
      where: { id: project.id },
      select: { id: true },
    });
    if (allowed) {
      expect(remaining).toBeNull();
    } else {
      expect(remaining).toMatchObject({ id: project.id });
    }
    if (!allowed) await prisma.project.delete({ where: { id: project.id } });
  });

  it.each(roles)("createInvitationAction enforces the persisted role for %s", async (role) => {
    authMock.mockResolvedValue({
      user: { id: users.get(role), role, clientId: role === "CLIENT" ? clientId : null },
    });
    const result = await createInvitationAction(workspaceId, {
      email: `action-${role.toLowerCase()}-${suffix}@example.test`,
      role: "MEMBER",
    });
    expect(result.ok).toBe(role === "OWNER" || role === "ADMIN");
  });

  it.each(roles)("changeMemberRoleAction enforces the persisted role for %s", async (role) => {
    authMock.mockResolvedValue({
      user: { id: users.get(role), role, clientId: role === "CLIENT" ? clientId : null },
    });
    const target = await prisma.user.create({
      data: {
        email: `role-target-${role.toLowerCase()}-${suffix}@example.test`,
        passwordHash: "integration-test-only-not-a-real-password-hash",
      },
      select: { id: true },
    });
    const membership = await prisma.workspaceMember.create({
      data: { workspaceId, userId: target.id, role: "MEMBER" },
      select: { id: true },
    });

    try {
      const result = await changeMemberRoleAction(workspaceId, {
        memberId: membership.id,
        role: "ADMIN",
      });
      expect(result.ok).toBe(role === "OWNER");
      const saved = await prisma.workspaceMember.findUniqueOrThrow({
        where: { id: membership.id },
        select: { role: true },
      });
      expect(saved.role).toBe(role === "OWNER" ? "ADMIN" : "MEMBER");
    } finally {
      await prisma.user.delete({ where: { id: target.id } });
    }
  });
  it.each(roles)("removeWorkspaceMemberAction enforces the persisted role for %s", async (role) => {
    authMock.mockResolvedValue({
      user: { id: users.get(role), role, clientId: role === "CLIENT" ? clientId : null },
    });
    const target = await prisma.user.create({
      data: {
        email: `remove-target-${role.toLowerCase()}-${suffix}@example.test`,
        passwordHash: "integration-test-only-not-a-real-password-hash",
      },
      select: { id: true },
    });
    const membership = await prisma.workspaceMember.create({
      data: { workspaceId, userId: target.id, role: "MEMBER" },
      select: { id: true },
    });

    try {
      const result = await removeWorkspaceMemberAction(workspaceId, {
        memberId: membership.id,
      });
      const allowed = role === "OWNER";
      expect(result.ok).toBe(allowed);
      const remaining = await prisma.workspaceMember.findUnique({
        where: { id: membership.id },
        select: { id: true },
      });
      if (allowed) {
        expect(remaining).toBeNull();
      } else {
        expect(remaining).toMatchObject({ id: membership.id });
      }
    } finally {
      await prisma.user.delete({ where: { id: target.id } });
    }
  });

});

describe("workspace owner invariant", () => {
  it("serializes concurrent owner demotions so one owner always remains", async () => {
    const ownerId = users.get("OWNER")!;
    const secondOwner = await prisma.user.create({
      data: {
        email: "second-owner-" + suffix + "@example.test",
        passwordHash: "integration-test-only-not-a-real-password-hash",
      },
      select: { id: true },
    });
    const ownerMembership = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId, userId: ownerId },
      select: { id: true },
    });
    const secondMembership = await prisma.workspaceMember.create({
      data: { workspaceId, userId: secondOwner.id, role: "OWNER" },
      select: { id: true },
    });

    try {
      const results = await Promise.allSettled([
        changeMemberRole(workspaceId, ownerId, { memberId: secondMembership.id, role: "ADMIN" }),
        changeMemberRole(workspaceId, secondOwner.id, { memberId: ownerMembership.id, role: "ADMIN" }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(await prisma.workspaceMember.count({ where: { workspaceId, role: "OWNER" } })).toBe(1);
    } finally {
      await prisma.user.delete({ where: { id: secondOwner.id } });
    }
  });

  it("enforces one client profile per linked user across workspaces", async () => {
    await expect(prisma.client.create({
      data: {
        workspaceId: otherWorkspaceId,
        userId: users.get("CLIENT")!,
        name: "Duplicate client profile",
        email: "duplicate-client-" + suffix + "@example.test",
      },
    })).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("deliverable workflow and concurrent review", () => {
  it("rejects client review before a draft has been submitted", async () => {
    const draft = await prisma.deliverable.create({
      data: { workspaceId, projectId, name: "Unsubmitted " + suffix, status: "DRAFT" },
      select: { id: true },
    });
    await expect(decideDeliverable(
      { workspaceId, deliverableId: draft.id, expectedRevision: 0, decision: "APPROVED" },
      users.get("CLIENT")!,
      clientId,
    )).rejects.toThrow("unavailable for review");
    expect(await prisma.review.count({ where: { workspaceId, deliverableId: draft.id } })).toBe(0);
  });

  it("allows one submission and exactly one decision for a revision under concurrent requests", async () => {
    const draft = await prisma.deliverable.create({
      data: {
        workspaceId,
        projectId,
        name: "Concurrent deliverable " + suffix,
        status: "DRAFT",
      },
      select: { id: true },
    });

    const submitted = await submitDeliverable(workspaceId, users.get("MEMBER")!, draft.id, 0);
    expect(submitted.status).toBe("SUBMITTED");

    const decisions = await Promise.allSettled([
      decideDeliverable(
        { workspaceId, deliverableId: draft.id, expectedRevision: submitted.revision, decision: "APPROVED" },
        users.get("CLIENT")!,
        clientId,
      ),
      decideDeliverable(
        {
          workspaceId,
          deliverableId: draft.id,
          expectedRevision: submitted.revision,
          decision: "CHANGES_REQUESTED",
          feedback: "Please revise this version.",
        },
        users.get("CLIENT")!,
        clientId,
      ),
    ]);

    expect(decisions.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(decisions.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.review.count({ where: { workspaceId, deliverableId: draft.id } })).toBe(1);

    const finalRecord = await prisma.deliverable.findUniqueOrThrow({
      where: { id: draft.id },
      select: { status: true, revision: true },
    });
    expect(["APPROVED", "CHANGES_REQUESTED"]).toContain(finalRecord.status);
    expect(finalRecord.revision).toBe(2);

    await expect(submitDeliverable(workspaceId, users.get("MEMBER")!, draft.id, finalRecord.revision))
      .rejects.toThrow();
  });

  it("atomically enforces the database-backed rate limit under concurrency", async () => {
    const key = "integration-rate-limit:" + suffix;
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () => consumeRateLimit(key, 1, 60)),
    );
    expect(attempts.filter(Boolean)).toHaveLength(1);
  });
});
