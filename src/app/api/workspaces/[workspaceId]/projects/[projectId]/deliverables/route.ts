import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/server/authz";
import { attachFileToDeliverable, createDeliverable } from "@/server/services/deliverable-service";
import { getStorageProvider } from "@/server/storage";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; projectId: string }> },
) {
  const { workspaceId, projectId } = await params;

  try {
    const { user } = await requireRole(workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    const formData = await request.formData();
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
    const key = `${workspaceId}/${projectId}/${randomUUID()}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
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
