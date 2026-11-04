import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, storageGetMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  storageGetMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/server/storage", () => ({
  getStorageProvider: () => ({ get: storageGetMock }),
}));

import { getPrisma } from "@/lib/prisma";
import { GET as downloadDeliverable } from "@/app/api/workspaces/[workspaceId]/deliverables/[deliverableId]/download/route";

const prisma = getPrisma();
const suffix = crypto.randomUUID();
let ownerA = "";
let ownerB = "";
let workspaceA = "";
let workspaceB = "";
let clientA = "";
let projectA = "";
let deliverableA = "";

beforeAll(async () => {
  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Storage Workspace A Owner",
        email: `storage-owner-a-${suffix}@example.test`,
        passwordHash: "integration-test-only",
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        name: "Storage Workspace B Owner",
        email: `storage-owner-b-${suffix}@example.test`,
        passwordHash: "integration-test-only",
      },
      select: { id: true },
    }),
  ]);
  ownerA = userA.id;
  ownerB = userB.id;

  const [a, b] = await Promise.all([
    prisma.workspace.create({
      data: {
        name: "Storage Workspace A",
        slug: `storage-a-${suffix}`,
        ownerId: ownerA,
        members: { create: { userId: ownerA, role: "OWNER" } },
      },
      select: { id: true },
    }),
    prisma.workspace.create({
      data: {
        name: "Storage Workspace B",
        slug: `storage-b-${suffix}`,
        ownerId: ownerB,
        members: { create: { userId: ownerB, role: "OWNER" } },
      },
      select: { id: true },
    }),
  ]);
  workspaceA = a.id;
  workspaceB = b.id;

  const client = await prisma.client.create({
    data: {
      workspaceId: workspaceA,
      name: "Storage Test Client",
      email: `storage-client-${suffix}@example.test`,
    },
    select: { id: true },
  });
  clientA = client.id;

  const project = await prisma.project.create({
    data: {
      workspaceId: workspaceA,
      clientId: clientA,
      name: "Storage Test Project",
    },
    select: { id: true },
  });
  projectA = project.id;

  const deliverable = await prisma.deliverable.create({
    data: {
      workspaceId: workspaceA,
      projectId: projectA,
      name: "Private file",
      fileKey: `workspaces/${workspaceA}/private-file`,
      fileName: "private.txt",
      mimeType: "text/plain",
      sizeBytes: 1,
    },
    select: { id: true },
  });
  deliverableA = deliverable.id;
});

afterAll(async () => {
  if (workspaceA) await prisma.workspace.delete({ where: { id: workspaceA } });
  if (workspaceB) await prisma.workspace.delete({ where: { id: workspaceB } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerA, ownerB].filter(Boolean) } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
  storageGetMock.mockResolvedValue(new Uint8Array([65]));
});

describe("private deliverable download workspace isolation", () => {
  it("does not allow a different workspace member to download the file", async () => {
    authMock.mockResolvedValue({ user: { id: ownerB, role: "OWNER" } });

    const response = await downloadDeliverable(new Request("https://clientflow.test/download"), {
      params: Promise.resolve({ workspaceId: workspaceB, deliverableId: deliverableA }),
    });

    expect(response.status).toBe(404);
    expect(storageGetMock).not.toHaveBeenCalled();
  });

  it("allows an authorized member of the owning workspace to download the file", async () => {
    authMock.mockResolvedValue({ user: { id: ownerA, role: "OWNER" } });

    const response = await downloadDeliverable(new Request("https://clientflow.test/download"), {
      params: Promise.resolve({ workspaceId: workspaceA, deliverableId: deliverableA }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("A");
    expect(storageGetMock).toHaveBeenCalledWith(`workspaces/${workspaceA}/private-file`);
  });
});
