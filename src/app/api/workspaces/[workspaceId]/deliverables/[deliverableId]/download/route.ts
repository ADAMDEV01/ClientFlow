import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { requireClientAccess, requireWorkspaceMember } from "@/server/authz";
import { getStorageProvider } from "@/server/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; deliverableId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { workspaceId, deliverableId } = await params;
  const prisma = getPrisma();
  const deliverable = await prisma.deliverable.findFirst({
    where: { id: deliverableId, workspaceId },
    select: {
      id: true,
      projectId: true,
      fileKey: true,
      fileName: true,
      mimeType: true,
    },
  });

  if (!deliverable?.fileKey) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  try {
    if (session.user.role === "CLIENT") {
      await requireClientAccess(workspaceId, deliverable.projectId);
      const visible = await prisma.deliverable.findFirst({
        where: {
          id: deliverableId,
          workspaceId,
          status: { in: ["SUBMITTED", "APPROVED", "CHANGES_REQUESTED"] },
        },
        select: { id: true },
      });
      if (!visible) return NextResponse.json({ error: "File not found." }, { status: 404 });
    } else {
      await requireWorkspaceMember(workspaceId);
    }

    const bytes = await getStorageProvider().get(deliverable.fileKey);
    const filename = (deliverable.fileName ?? "download").replace(/[\r\n"]/g, "_");
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": deliverable.mimeType ?? "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File access denied or unavailable." }, { status: 403 });
  }
}
