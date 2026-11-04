import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const s3Mocks = vi.hoisted(() => ({
  send: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = s3Mocks.send;
  },
  PutObjectCommand: class {
    constructor(input: unknown) {
      s3Mocks.put(input);
    }
  },
  GetObjectCommand: class {},
  DeleteObjectCommand: class {},
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  s3Mocks.send.mockReset().mockResolvedValue({});
  s3Mocks.put.mockReset();
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/clientflow";
  process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
  process.env.S3_BUCKET = "clientflow-storage";
  process.env.S3_REGION = "auto";
  process.env.S3_ACCESS_KEY_ID = "test-access-key";
  process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.S3_ENDPOINT = "https://example.r2.cloudflarestorage.com";
  delete process.env.S3_SERVER_SIDE_ENCRYPTION;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

async function uploadTestObject() {
  const { getStorageProvider } = await import("@/server/storage");
  await getStorageProvider().put({
    key: "workspace/file",
    contentType: "text/plain",
    bytes: new Uint8Array([1, 2, 3]),
  });
}

describe("S3 storage encryption compatibility", () => {
  it("requests AES256 server-side encryption by default", async () => {
    await uploadTestObject();
    expect(s3Mocks.put).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: "clientflow-storage",
      ServerSideEncryption: "AES256",
    }));
  });

  it("omits the unsupported SSE header when configured for Cloudflare R2", async () => {
    process.env.S3_SERVER_SIDE_ENCRYPTION = "NONE";
    await uploadTestObject();
    expect(s3Mocks.put).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: "clientflow-storage",
      Key: "workspace/file",
    }));
    expect(s3Mocks.put.mock.calls[0][0]).not.toHaveProperty("ServerSideEncryption");
  });
});
