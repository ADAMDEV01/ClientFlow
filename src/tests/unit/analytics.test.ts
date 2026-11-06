import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPrismaMock } = vi.hoisted(() => ({
  getPrismaMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: getPrismaMock }));

import { getWorkspaceActivityOptions } from "@/server/queries/analytics";

describe("workspace activity filter options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads every project and distinct actors without scanning activity rows in memory", async () => {
    const projects = [
      { id: "project-a", name: "Alpha" },
      { id: "project-b", name: "Beta" },
    ];
    const findMany = vi.fn().mockResolvedValue(projects);
    const queryRaw = vi.fn().mockResolvedValue([
      { actorId: "user-a", name: "Adam", email: "adam@example.com" },
      { actorId: "user-b", name: null, email: "zoe@example.com" },
    ]);
    getPrismaMock.mockReturnValue({
      project: { findMany },
      $queryRaw: queryRaw,
    });

    const result = await getWorkspaceActivityOptions("workspace-a");

    expect(findMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-a" },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(result).toEqual({
      projects,
      actors: [
        { id: "user-a", label: "Adam" },
        { id: "user-b", label: "zoe@example.com" },
      ],
    });
  });
});
