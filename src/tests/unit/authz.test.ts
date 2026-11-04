import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, getPrismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getPrismaMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ getPrisma: getPrismaMock }));

import { requireClientProjectAccess, requireRole, requireUser, requireWorkspaceMember } from "@/server/authz";

describe("authorization guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-a", role: "MEMBER", clientId: null } });
  });

  it("rejects unauthenticated requests", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects cross-workspace membership access", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    getPrismaMock.mockReturnValue({ workspaceMember: { findFirst } });
    await expect(requireWorkspaceMember("workspace-b")).rejects.toMatchObject({ code: "WORKSPACE_ACCESS_DENIED" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-b", userId: "user-a" },
      select: { id: true, workspaceId: true, userId: true, role: true },
    });
  });

  it("rejects a role that is not allowed", async () => {
    getPrismaMock.mockReturnValue({
      workspaceMember: { findFirst: vi.fn().mockResolvedValue({ id: "m1", workspaceId: "w1", userId: "user-a", role: "MEMBER" }) },
    });
    await expect(requireRole("w1", ["OWNER", "ADMIN"])).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
  });

  it("scopes client access to the signed-in client's own profile and workspace", async () => {
    authMock.mockResolvedValue({ user: { id: "client-user", role: "CLIENT", clientId: "client-1" } });
    const findFirst = vi.fn().mockResolvedValue(null);
    getPrismaMock.mockReturnValue({ project: { findFirst } });
    await expect(requireClientProjectAccess("workspace-2", "project-2")).rejects.toMatchObject({ code: "CLIENT_ACCESS_DENIED" });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "project-2",
        workspaceId: "workspace-2",
        clientId: "client-1",
        client: { userId: "client-user" },
      }),
    }));
  });
});
