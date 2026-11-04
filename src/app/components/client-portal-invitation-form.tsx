"use client";

import { useActionState } from "react";
import {
  acceptClientPortalInvitationFormAction,
  createClientPortalInvitationFormAction,
  type AcceptClientInvitationState,
  type ClientInvitationFormState,
} from "@/app/actions/client-invitation-actions";

const initialInvite: ClientInvitationFormState = {};
const initialAccept: AcceptClientInvitationState = {};

export function ClientPortalInvitationForm({ workspaceId, clientId, clientName }: { workspaceId: string; clientId: string; clientName: string }) {
  const [state, action, pending] = useActionState(createClientPortalInvitationFormAction, initialInvite);
  return <form action={action} className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
    <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="clientId" value={clientId} />
    {state.error ? <p role="alert" className="text-xs text-red-600">{state.error}</p> : null}
    {state.invitationUrl ? <div className="mt-2 rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800"><p className="font-semibold">{state.emailSent ? `Invitation email sent to ${clientName}.` : `Invitation created for ${clientName}.`}</p><p className="mt-1 break-all">{state.invitationUrl}</p><p className="mt-1 text-slate-500">Expires {state.expiresAt}. {state.emailSent ? "A copy of the invitation link is available below." : "Copy and send this link manually; email delivery is not configured."}</p></div> : <><p className="text-xs text-slate-500">Send a secure, single-use portal invitation to this client&apos;s email address.</p><button disabled={pending} className="mt-2 text-xs font-semibold text-indigo-600 disabled:opacity-60">{pending ? "Sending…" : "Invite to client portal"}</button></>}
  </form>;
}

export function ClientInvitationAcceptForm({ token, email, authenticated }: { token: string; email: string; authenticated: boolean }) {
  const [state, action, pending] = useActionState(acceptClientPortalInvitationFormAction, initialAccept);
  return <form action={action} className="mt-6 grid gap-3">
    <input type="hidden" name="token" value={token} />
    {!authenticated ? <><label className="grid gap-1 text-sm">Your name<input name="name" required minLength={2} maxLength={80} className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700" /></label><label className="grid gap-1 text-sm">Create a password<input name="password" type="password" required minLength={12} maxLength={128} className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700" /></label><p className="text-xs text-slate-500">Your account will use {email}. Use at least 12 characters.</p></> : null}
    {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
    <button disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Accepting…" : authenticated ? "Accept invitation" : "Create account and accept"}</button>
  </form>;
}
