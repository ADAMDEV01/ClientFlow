import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/server/services/notification", () => ({ notifyDeliverable: vi.fn().mockResolvedValue(undefined) }));

import { getPrisma } from "@/lib/prisma";
import { AuthzError, requireClientProjectAccess, requireRole, requireWorkspaceMember } from "@/server/authz";
import { submitDeliverable } from "@/server/services/deliverable-service";

const prisma = getPrisma();
const suffix = crypto.randomUUID();
const ids = {
  owner: `owner-${suffix}`, admin: `admin-${suffix}`, member: `member-${suffix}`,
  outsider: `outsider-${suffix}`, clientUser: `client-${suffix}`,
  workspace: `workspace-${suffix}`, otherWorkspace: `other-${suffix}`,
};

let projectId = "";
let clientId = "";
let deliverableId = "";

async function asUser(id: string, role: string, extra: Record<string, unknown> = {}) {
  authMock.mockResolvedValue({ user: { id, role, clientId: null, ...extra } });
}

beforeAll(async () => {
  const users = [ids.owner, ids.admin, ids.member, ids.outsider, ids.clientUser].map((id) => ({
    id, email: `${id}@integration.clientflow.local`, passwordHash: "integration-only",
  }));
  await prisma.user.createMany({ data: users });
  await prisma.workspace.createMany({ data: [
    { id: ids.workspace, name: "Integration Workspace", slug: `integration-${suffix}`, ownerId: ids.owner },
    { id: ids.otherWorkspace, name: "Other Workspace", slug: `other-${suffix}`, ownerId: ids.outsider },
  ] });
  await prisma.workspaceMember.createMany({ data: [
    { workspaceId: ids.workspace, userId: ids.owner, role: "OWNER" },
    { workspaceId: ids.workspace, userId: ids.admin, role: "ADMIN" },
    { workspaceId: ids.workspace, userId: ids.member, role: "MEMBER" },
    { workspaceId: ids.otherWorkspace, userId: ids.outsider, role: "OWNER" },
  ] });
  const client = await prisma.client.create({
    data: { workspaceId: ids.workspace, name: "Integration Client", email: `client-${suffix}@example.test`, userId: ids.clientUser },
    select: { id: true },
  });
  clientId = client.id;
  const project = await prisma.project.create({
    data: { workspaceId: ids.workspace, clientId, name: "Integration Project" },
    select: { id: true },
  });
  projectId = project.id;
  const deliverable = await prisma.deliverable.create({
    data: { workspaceId: ids.workspace, projectId, name: "Concurrency Check" },
    select: { id: true },
  });
  deliverableId = deliverable.id;
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: [ids.workspace, ids.otherWorkspace] } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
});

describe("database-backed authorization matrix", () => {
  const actions = [
    { name: "project and task mutations", allowed: ["OWNER", "ADMIN", "MEMBER"] as const },
    { name: "deliverable upload and submission", allowed: ["OWNER", "ADMIN", "MEMBER"] as const },
    { name: "client invitation management", allowed: ["OWNER", "ADMIN"] as const },
    { name: "workspace role administration", allowed: ["OWNER"] as const },
  ];

  it.each(["OWNER", "ADMIN", "MEMBER"] as const)("resolves the persisted %s workspace role", async (role) => {
    const userId = role === "OWNER" ? ids.owner : role === "ADMIN" ? ids.admin : ids.member;
    await asUser(userId, role);
    const result = await requireWorkspaceMember(ids.workspace);
    expect(result.membership.role).toBe(role);
  });

  it.each(actions)("$name enforces every team role", async ({ allowed }) => {
    for (const role of ["OWNER", "ADMIN", "MEMBER"] as const) {
      const userId = role === "OWNER" ? ids.owner : role === "ADMIN" ? ids.admin : ids.member;
      await asUser(userId, role);
      if (allowed.includes(role)) {
        await expect(requireRole(ids.workspace, allowed)).resolves.toMatchObject({ membership: { role } });
      } else {
        await expect(requireRole(ids.workspace, allowed)).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
      }
    }
  });

  it("denies a user from another workspace even when the resource ID is known", async () => {
    await asUser(ids.outsider, "OWNER");
    await expect(requireWorkspaceMember(ids.workspace)).rejects.toBeInstanceOf(AuthzError);
    await expect(requireRole(ids.workspace, ["OWNER", "ADMIN", "MEMBER"])).rejects.toMatchObject({ code: "WORKSPACE_ACCESS_DENIED" });
  });

  it("scopes client access to the linked client, project, and workspace", async () => {
    await asUser(ids.clientUser, "CLIENT", { clientId });
    await expect(requireClientProjectAccess(ids.workspace, projectId)).resolves.toMatchObject({ project: { id: projectId } });
    await expect(requireClientProjectAccess(ids.otherWorkspace, projectId)).rejects.toMatchObject({ code: "CLIENT_ACCESS_DENIED" });
  });
});

describe("deliverable concurrency against PostgreSQL", () => {
  it("allows exactly one concurrent submission for the same revision", async () => {
    await asUser(ids.member, "MEMBER");
    const results = await Promise.allSettled([
      submitDeliverable(ids.workspace, ids.member, deliverableId, 0),
      submitDeliverable(ids.workspace, ids.member, deliverableId, 0),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const saved = await prisma.deliverable.findUniqueOrThrow({ where: { id: deliverableId } });
    expect(saved.status).toBe("SUBMITTED");
    expect(saved.revision).toBe(1);
  });
});
