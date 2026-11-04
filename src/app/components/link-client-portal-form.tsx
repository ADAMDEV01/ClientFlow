"use client";

import { useActionState } from "react";
import { linkClientPortalFormAction, type LinkPortalFormState } from "@/app/actions/project-actions";

const initialState: LinkPortalFormState = {};

export function LinkClientPortalForm({ workspaceId, clientId, email }: { workspaceId: string; clientId: string; email: string }) {
  const [state, action, pending] = useActionState(linkClientPortalFormAction, initialState);
  return <form action={action} className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
    <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="email" value={email} />
    {state.error ? <p role="alert" className="text-xs text-red-600">{state.error}</p> : null}
    {state.success ? <p role="status" className="text-xs text-emerald-600">{state.success}</p> : <><p className="text-xs text-slate-500">Link an existing ClientFlow account with this email to enable the client portal.</p><button disabled={pending} className="text-xs font-semibold text-indigo-600 disabled:opacity-60">{pending ? "Linking…" : "Link portal account"}</button></>}
  </form>;
}
