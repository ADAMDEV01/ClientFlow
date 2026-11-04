"use client";

import { useActionState } from "react";
import { switchWorkspaceAction, type WorkspaceSwitchState } from "@/app/actions/workspace-actions";

type MembershipOption = { role: "OWNER" | "ADMIN" | "MEMBER"; workspace: { id: string; name: string; slug: string } };
const initialState: WorkspaceSwitchState = {};

export function WorkspaceSwitcher({ memberships, activeWorkspaceId }: { memberships: MembershipOption[]; activeWorkspaceId: string | null }) {
  const [state, action, pending] = useActionState(switchWorkspaceAction, initialState);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
      <label htmlFor="workspaceId" className="sr-only">Active workspace</label>
      <select id="workspaceId" name="workspaceId" defaultValue={activeWorkspaceId ?? ""} required className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700">
        {memberships.map(({ workspace, role }) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {role}</option>)}
      </select>
      <button disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Switching…" : "Switch workspace"}</button>
      {state.error ? <p role="alert" className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
