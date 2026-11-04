"use client";

import { useActionState } from "react";
import { createInvitationFormAction, type InvitationFormState } from "@/app/actions/invitation-actions";

const initialState: InvitationFormState = {};

export function InvitationForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(createInvitationFormAction, initialState);
  return <form action={action} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
    <input type="hidden" name="workspaceId" value={workspaceId} />
    <h2 className="font-semibold">Invite a teammate</h2>
    <input name="email" type="email" required placeholder="teammate@example.com" className="rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm dark:border-slate-700" />
    <select name="role" className="rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm dark:border-slate-700"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option></select>
    {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
    {state.inviteUrl ? <div className="rounded-xl bg-slate-100 p-3 text-xs break-all dark:bg-slate-800"><p className="font-semibold">Invitation link — copy and send it securely:</p><p className="mt-2">{state.inviteUrl}</p></div> : null}
    <button disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Creating…" : "Create invitation"}</button>
  </form>;
}
