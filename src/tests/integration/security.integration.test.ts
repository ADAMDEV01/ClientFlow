import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: authMock }));

import { getPrisma } from "@/lib/prisma";
import { requireClientProjectAccess, requireRole } from "@/server/authz";
import { decideDeliverable, submitDeliverable } from "@/server/services/deliverable-service";
import { consumeRateLimit } from "@/server/services/rate-limit";

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
      ownerId: clientUserId,
      members: { create: { userId: clientUserId, role: "OWNER" } },
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
  ] as const;

  it.each(roles.flatMap((role) =>
    actions.map((action) => ({
      role,
      action: action.name,
      allowed: (action.allowed as readonly string[]).includes(role),
      rolesAllowed: action.allowed,
    })),
  ))("$role: $action => allowed=$allowed", async ({ role, allowed, rolesAllowed }) => {
    authMock.mockResolvedValue({
      user: { id: users.get(role), role, clientId: role === "CLIENT" ? clientId : null },
    });

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

describe("deliverable workflow and concurrent review", () => {
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
