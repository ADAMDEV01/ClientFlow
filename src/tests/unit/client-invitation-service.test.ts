import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPrismaMock, writeActivityMock, rateLimitMock } = vi.hoisted(() => ({
  getPrismaMock: vi.fn(),
  writeActivityMock: vi.fn().mockResolvedValue(undefined),
  rateLimitMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: getPrismaMock }));
vi.mock("@/server/services/activity", () => ({ writeActivity: writeActivityMock }));
vi.mock("@/server/services/rate-limit", () => ({ consumeRateLimit: rateLimitMock }));

import { acceptClientPortalInvitation, getClientPortalInvitation } from "@/server/services/client-invitation-service";

const token = "one-time-client-invitation-token";
const tokenHash = createHash("sha256").update(token).digest("hex");
const invitation = { id: "invite-1", workspaceId: "workspace-1", clientId: "client-1", email: "client@example.com" };

describe("client portal invitation security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("looks up only a pending, unexpired invitation by its SHA-256 hash", async () => {
    const findFirst = vi.fn().mockResolvedValue({ ...invitation, expiresAt: new Date(Date.now() + 60_000), client: { name: "Client", email: invitation.email, userId: null }, workspace: { name: "Studio" } });
    getPrismaMock.mockReturnValue({ clientInvitation: { findFirst } });
    const result = await getClientPortalInvitation(token);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash, status: "PENDING", expiresAt: { gt: expect.any(Date) } },
    }));
    expect(result?.email).toBe(invitation.email);
  });

  it("rejects an invitation when the signed-in email does not match", async () => {
    const tx = { clientInvitation: { findFirst: vi.fn().mockResolvedValue(invitation), updateMany: vi.fn() }, client: { findFirst: vi.fn(), updateMany: vi.fn() } };
    getPrismaMock.mockReturnValue({ $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) });
    await expect(acceptClientPortalInvitation("user-1", "attacker@example.com", token)).rejects.toThrow("belongs to another email");
    expect(tx.clientInvitation.updateMany).not.toHaveBeenCalled();
    expect(tx.client.updateMany).not.toHaveBeenCalled();
  });

  it("does not link the client if another request already consumed the token", async () => {
    const tx = {
      clientInvitation: { findFirst: vi.fn().mockResolvedValue(invitation), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      client: { findFirst: vi.fn().mockResolvedValueOnce({ id: "client-1", email: invitation.email, userId: null }).mockResolvedValueOnce(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    getPrismaMock.mockReturnValue({ $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) });
    await expect(acceptClientPortalInvitation("user-1", invitation.email, token)).rejects.toThrow("already been used");
    expect(tx.client.updateMany).not.toHaveBeenCalled();
    expect(writeActivityMock).not.toHaveBeenCalled();
  });

  it("links the client and consumes the invitation exactly once on acceptance", async () => {
    const tx = {
      clientInvitation: { findFirst: vi.fn().mockResolvedValue(invitation), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      client: { findFirst: vi.fn().mockResolvedValue({ id: "client-1", email: invitation.email, userId: null }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    getPrismaMock.mockReturnValue({ $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) });
    await expect(acceptClientPortalInvitation("user-1", invitation.email, token)).resolves.toEqual({ workspaceId: "workspace-1", clientId: "client-1" });
    expect(tx.clientInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "invite-1", status: "PENDING" }) }));
    expect(tx.client.updateMany).toHaveBeenCalledWith({ where: { id: "client-1", workspaceId: "workspace-1", userId: null }, data: { userId: "user-1" } });
    expect(writeActivityMock).toHaveBeenCalledOnce();
  });
});
