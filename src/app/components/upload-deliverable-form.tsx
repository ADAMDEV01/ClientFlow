"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function UploadDeliverableForm({ workspaceId, projectId, deliverableId }: { workspaceId: string; projectId: string; deliverableId?: string }) {
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(null);
    setIsError(false);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects/${projectId}/deliverables`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Upload failed.");
      setMessage(deliverableId ? "File attached to the new version." : "File uploaded as a new draft deliverable.");
      formRef.current?.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return <form ref={formRef} action={submit} className="mt-4 grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
    <p className="text-sm font-medium">Upload a file</p>
    {deliverableId ? <input type="hidden" name="deliverableId" value={deliverableId} /> : null}
    {!deliverableId ? <input name="name" required minLength={2} maxLength={160} placeholder="Deliverable name" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" /> : null}
    {!deliverableId ? <textarea name="description" maxLength={3000} rows={2} placeholder="Description (optional)" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" /> : null}
    <input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx" className="text-sm" />
    <p className="text-xs text-slate-500">PDF, PNG, JPEG, WebP, DOCX or XLSX · Maximum 4 MB.</p>
    {message ? <p role={isError ? "alert" : "status"} className={isError ? "text-sm text-red-600" : "text-sm text-emerald-600"}>{message}</p> : null}
    <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Uploading…" : "Upload deliverable"}</button>
  </form>;
}
