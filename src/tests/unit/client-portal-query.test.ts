import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPrismaMock, requireUserMock, requireClientAccessMock } = vi.hoisted(() => ({
  getPrismaMock: vi.fn(),
  requireUserMock: vi.fn(),
  requireClientAccessMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: getPrismaMock }));
vi.mock("@/server/authz", () => ({ requireUser: requireUserMock, requireClientAccess: requireClientAccessMock }));

import { getClientPortalProjects, getClientProjectPortal } from "@/server/queries/client-portal";

describe("client portal query isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "client-user", role: "CLIENT", workspaceId: "workspace-a", clientId: "client-a" });
    requireClientAccessMock.mockResolvedValue({ user: { id: "client-user", clientId: "client-a" }, project: { id: "project-a" } });
  });

  it("scopes the project list to the authenticated client and workspace at query level", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "project-a", workspaceId: "workspace-a", name: "Website", status: "ACTIVE", dueDate: null, updatedAt: new Date(), milestones: [{ status: "COMPLETED" }], tasks: [{ status: "DONE" }, { status: "TODO" }] }]);
    getPrismaMock.mockReturnValue({ project: { findMany } });
    const projects = await getClientPortalProjects();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-a", clientId: "client-a", client: { userId: "client-user" } },
      select: expect.objectContaining({ tasks: { where: { visibleToClient: true }, select: { status: true } } }),
    }));
    expect(projects[0].progress).toBe(67);
  });

  it("filters internal tasks and unpublished deliverables inside the project query", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "project-a", workspaceId: "workspace-a", name: "Website", description: null, status: "ACTIVE", dueDate: null,
      milestones: [{ id: "m1", name: "Launch", status: "COMPLETED", dueDate: null, completedAt: new Date() }],
      tasks: [{ id: "t1", title: "Public task", status: "DONE", dueDate: null, milestoneId: null }],
      deliverables: [{ id: "d1", name: "Proposal", description: null, version: 1, status: "SUBMITTED", fileName: "proposal.pdf", mimeType: "application/pdf", sizeBytes: 100, revision: 1, submittedAt: new Date(), updatedAt: new Date() }],
    });
    getPrismaMock.mockReturnValue({ project: { findFirst } });
    const project = await getClientProjectPortal("workspace-a", "project-a");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "project-a", workspaceId: "workspace-a", clientId: "client-a", client: { userId: "client-user" } },
      select: expect.objectContaining({
        tasks: expect.objectContaining({ where: { visibleToClient: true } }),
        deliverables: expect.objectContaining({ where: { status: { in: ["SUBMITTED", "APPROVED", "CHANGES_REQUESTED"] } } }),
      }),
    }));
    expect(project?.progress).toBe(100);
  });

  it("does not query projects when the authenticated account is not a client", async () => {
    requireUserMock.mockResolvedValue({ id: "staff-user", role: "MEMBER", workspaceId: "workspace-a", clientId: null });
    const findMany = vi.fn();
    getPrismaMock.mockReturnValue({ project: { findMany } });
    await expect(getClientPortalProjects()).rejects.toThrow("Client portal access is required");
    expect(findMany).not.toHaveBeenCalled();
  });
});
