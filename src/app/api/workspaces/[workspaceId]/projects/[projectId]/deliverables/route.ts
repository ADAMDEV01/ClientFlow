import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/server/authz";
import { attachFileToDeliverable, createDeliverable } from "@/server/services/deliverable-service";
import { getStorageProvider } from "@/server/storage";
import { consumeRateLimit } from "@/server/services/rate-limit";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

async function readBoundedBody(request: Request, maxBytes: number): Promise<ArrayBuffer | null> {
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new ArrayBuffer(total);
  const output = new Uint8Array(body);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; projectId: string }> },
) {
  const { workspaceId, projectId } = await params;

  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    const allowed = await consumeRateLimit(`upload:${workspaceId}:${user.id}`, 20, 60 * 60);
    if (!allowed) return NextResponse.json({ error: "Upload rate limit reached. Try again later." }, { status: 429 });
    const maxRequestSize = MAX_FILE_SIZE + 256 * 1024;
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      if (!/^\d+$/.test(contentLengthHeader)) {
        return NextResponse.json({ error: "Invalid upload request size." }, { status: 400 });
      }
      const contentLength = Number(contentLengthHeader);
      if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
        return NextResponse.json({ error: "Invalid upload request size." }, { status: 400 });
      }
      if (contentLength > maxRequestSize) {
        return NextResponse.json({ error: "Upload request exceeds the 4 MB file limit." }, { status: 413 });
      }
    }

    // Enforce the same limit while reading the stream, including chunked
    // requests that do not provide Content-Length.
    const requestBody = await readBoundedBody(request, maxRequestSize);
    if (!requestBody) {
      return NextResponse.json({ error: "Upload request exceeds the 4 MB file limit." }, { status: 413 });
    }
    const formData = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: requestBody,
    }).formData();
    const name = String(formData.get("name") ?? "");
    const description = String(formData.get("description") ?? "");
    const deliverableId = String(formData.get("deliverableId") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File must be between 1 byte and 4 MB." }, { status: 413 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "This file type is not supported." }, { status: 415 });
    }

    const safeDisplayName = file.name.replace(/[\\/\r\n\0]/g, "_").slice(0, 255) || "download";
    const extension = safeDisplayName.split(".").pop()?.toLowerCase();
    const expectedExtension = file.type === "application/pdf" ? "pdf"
      : file.type === "image/png" ? "png"
      : file.type === "image/jpeg" ? "jpg"
      : file.type === "image/webp" ? "webp"
      : file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? "docx"
      : file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? "xlsx"
      : "";
    if (!expectedExtension || (extension !== expectedExtension && !(file.type === "image/jpeg" && extension === "jpeg"))) {
      return NextResponse.json({ error: "The file extension does not match its type." }, { status: 415 });
    }
    const key = `${workspaceId}/${projectId}/${randomUUID()}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = Buffer.from(bytes.subarray(0, 12)).toString("hex");
    const validSignature = file.type === "application/pdf" ? signature.startsWith("255044462d")
      : file.type === "image/png" ? signature.startsWith("89504e470d0a1a0a")
      : file.type === "image/jpeg" ? signature.startsWith("ffd8ff")
      : file.type === "image/webp" ? signature.startsWith("52494646") && signature.slice(16, 24) === "57454250"
      : file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? signature.startsWith("504b0304")
      : false;
    if (!validSignature) {
      return NextResponse.json({ error: "The file content does not match its declared type." }, { status: 415 });
    }
    const storage = getStorageProvider();

    await storage.put({ key, contentType: file.type, bytes });

    try {
      const fileMetadata = {
        fileKey: key,
        fileName: safeDisplayName,
        mimeType: file.type,
        sizeBytes: file.size,
      };
      const deliverable = deliverableId
        ? await attachFileToDeliverable(workspaceId, user.id, projectId, deliverableId, fileMetadata)
        : await createDeliverable(workspaceId, user.id, {
            projectId,
            name,
            description: description || undefined,
            ...fileMetadata,
          });

      return NextResponse.json({ data: deliverable }, { status: 201 });
    } catch (error) {
      await storage.delete(key);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message.includes("not allowed") || message.includes("denied") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
