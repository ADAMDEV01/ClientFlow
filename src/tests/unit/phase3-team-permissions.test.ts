import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPrismaMock, writeActivityMock } = vi.hoisted(() => ({
  getPrismaMock: vi.fn(),
  writeActivityMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: getPrismaMock }));
vi.mock("@/server/services/activity", () => ({ writeActivity: writeActivityMock }));

import { changeMemberRole, removeWorkspaceMember } from "@/server/services/phase3-service";

describe("phase 3 team ownership invariants", () => {
  const workspaceId = "workspace-a";
  const actorId = "owner-a";
  const memberId = "c123456789012345678901234";
  type MockTx = { workspaceMember: { findFirst: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } };
  let tx: MockTx;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = {
      workspaceMember: {
        findFirst: vi.fn().mockResolvedValue({ id: memberId, userId: "owner-b", role: "OWNER" }),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    getPrismaMock.mockReturnValue({ $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) });
  });

  it("prevents demoting the last owner", async () => {
    await expect(changeMemberRole(workspaceId, actorId, { memberId, role: "ADMIN" })).rejects.toThrow("at least one owner");
    expect(tx.workspaceMember.update).not.toHaveBeenCalled();
    expect(writeActivityMock).not.toHaveBeenCalled();
  });

  it("prevents removing the last owner", async () => {
    await expect(removeWorkspaceMember(workspaceId, actorId, { memberId })).rejects.toThrow("last owner");
    expect(tx.workspaceMember.delete).not.toHaveBeenCalled();
    expect(writeActivityMock).not.toHaveBeenCalled();
  });

  it("rejects a member ID that is not in the requested workspace", async () => {
    tx.workspaceMember.findFirst.mockResolvedValue(null);
    await expect(removeWorkspaceMember(workspaceId, actorId, { memberId })).rejects.toThrow("not found");
    expect(tx.workspaceMember.delete).not.toHaveBeenCalled();
  });

  it("prevents an owner from removing themselves", async () => {
    tx.workspaceMember.findFirst.mockResolvedValue({ id: memberId, userId: actorId, role: "OWNER" });
    await expect(removeWorkspaceMember(workspaceId, actorId, { memberId })).rejects.toThrow("cannot remove yourself");
    expect(tx.workspaceMember.delete).not.toHaveBeenCalled();
  });
});
