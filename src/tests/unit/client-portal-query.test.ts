import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getPrismaMock,
  requireUserMock,
  requireClientAccessMock,
} = vi.hoisted(() => ({
  getPrismaMock: vi.fn(),
  requireUserMock: vi.fn(),
  requireClientAccessMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: getPrismaMock }));
vi.mock("@/server/authz", () => ({
  requireUser: requireUserMock,
  requireClientAccess: requireClientAccessMock,
}));

import { getClientPortalProjects, getClientProjectPortal } from "@/server/queries/client-portal";

describe("client portal query isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "client-user",
      role: "CLIENT",
      workspaceId: "workspace-a",
      clientId: "client-a",
    });
    requireClientAccessMock.mockResolvedValue({
      user: { id: "client-user", clientId: "client-a" },
      project: { id: "project-a" },
    });
  });

  it("scopes and paginates projects and calculates progress with grouped counts", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "project-a",
        workspaceId: "workspace-a",
        name: "Website",
        status: "ACTIVE",
        dueDate: null,
        updatedAt: new Date(),
      },
    ]);
    const taskGroupBy = vi.fn().mockResolvedValue([
      { projectId: "project-a", status: "DONE", _count: { _all: 1 } },
      { projectId: "project-a", status: "TODO", _count: { _all: 1 } },
    ]);
    const milestoneGroupBy = vi.fn().mockResolvedValue([
      { projectId: "project-a", status: "COMPLETED", _count: { _all: 1 } },
    ]);
    getPrismaMock.mockReturnValue({
      project: { findMany },
      task: { groupBy: taskGroupBy },
      milestone: { groupBy: milestoneGroupBy },
    });

    const result = await getClientPortalProjects("previous-project");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "workspace-a",
          clientId: "client-a",
          client: { userId: "client-user" },
        },
        cursor: { id: "previous-project" },
        skip: 1,
        take: 51,
      }),
    );
    expect(taskGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-a",
          visibleToClient: true,
        }),
      }),
    );
    expect(result.projects[0].progress).toBe(67);
    expect(result.hasMore).toBe(false);
  });

  it("filters internal tasks and unpublished deliverables inside the project query", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "project-a",
      workspaceId: "workspace-a",
      name: "Website",
      description: null,
      status: "ACTIVE",
      dueDate: null,
      milestones: [
        {
          id: "m1",
          name: "Launch",
          status: "COMPLETED",
          dueDate: null,
          completedAt: new Date(),
        },
      ],
      tasks: [
        {
          id: "t1",
          title: "Public task",
          status: "DONE",
          dueDate: null,
          milestoneId: null,
        },
      ],
      deliverables: [
        {
          id: "d1",
          name: "Proposal",
          description: null,
          version: 1,
          status: "SUBMITTED",
          fileName: "proposal.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
          revision: 1,
          submittedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const taskGroupBy = vi.fn().mockResolvedValue([
      { status: "DONE", _count: { _all: 1 } },
    ]);
    const milestoneGroupBy = vi.fn().mockResolvedValue([
      { status: "COMPLETED", _count: { _all: 1 } },
    ]);
    getPrismaMock.mockReturnValue({
      project: { findFirst },
      task: { groupBy: taskGroupBy },
      milestone: { groupBy: milestoneGroupBy },
    });

    const project = await getClientProjectPortal("workspace-a", "project-a");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "project-a",
          workspaceId: "workspace-a",
          clientId: "client-a",
          client: { userId: "client-user" },
        },
        select: expect.objectContaining({
          tasks: expect.objectContaining({ where: { visibleToClient: true } }),
          deliverables: expect.objectContaining({
            where: {
              status: { in: ["SUBMITTED", "APPROVED", "CHANGES_REQUESTED"] },
            },
            take: 50,
          }),
        }),
      }),
    );
    expect(project?.progress).toBe(100);
  });

  it("does not query projects when the authenticated account is not a client", async () => {
    requireUserMock.mockResolvedValue({
      id: "staff-user",
      role: "MEMBER",
      workspaceId: "workspace-a",
      clientId: null,
    });
    const findMany = vi.fn();
    getPrismaMock.mockReturnValue({ project: { findMany } });

    await expect(getClientPortalProjects()).rejects.toThrow(
      "Client portal access is required",
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
