import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getServerEnv } from "@/lib/env";
import type { StorageProvider, StoredObject } from "@/server/storage/types";

function safeKey(key: string) {
  if (!/^[a-zA-Z0-9/_-]+$/.test(key) || key.includes("..")) {
    throw new Error("Invalid storage key.");
  }
  return key;
}

class LocalStorageProvider implements StorageProvider {
  private readonly root = path.join(process.cwd(), ".clientflow-storage");

  private resolveKey(key: string) {
    const target = path.resolve(this.root, safeKey(key));
    if (!target.startsWith(this.root + path.sep)) throw new Error("Invalid storage path.");
    return target;
  }

  async put(object: StoredObject) {
    const target = this.resolveKey(object.key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, object.bytes, { flag: "wx" });
  }

  async get(key: string) {
    return new Uint8Array(await readFile(this.resolveKey(key)));
  }

  async delete(key: string) {
    await rm(this.resolveKey(key), { force: true });
  }
}

class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly serverSideEncryption: "AES256" | undefined;

  constructor() {
    const env = getServerEnv();
    if (!env.S3_BUCKET || !env.S3_REGION || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 storage is not fully configured.");
    }
    this.bucket = env.S3_BUCKET;
    this.serverSideEncryption = env.S3_SERVER_SIDE_ENCRYPTION === "NONE" ? undefined : "AES256";
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async put(object: StoredObject) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: safeKey(object.key),
      Body: object.bytes,
      ContentType: object.contentType,
      ...(this.serverSideEncryption
        ? { ServerSideEncryption: this.serverSideEncryption }
        : {}),
    }));
  }

  async get(key: string) {
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: safeKey(key),
    }));
    if (!result.Body) throw new Error("Stored file was empty.");
    return new Uint8Array(await result.Body.transformToByteArray());
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: safeKey(key),
    }));
  }
}

let provider: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider = process.env.NODE_ENV === "production"
      ? new S3StorageProvider()
      : new LocalStorageProvider();
  }
  return provider;
}
