"use client";

import { useActionState } from "react";
import { createWorkspaceAction, type WorkspaceFormState } from "@/app/actions/workspace-actions";

const initialState: WorkspaceFormState = {};

export function WorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspaceAction, initialState);

  return (
    <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="workspace-name" className="mb-2 block text-sm font-medium">Workspace name</label>
        <input id="workspace-name" name="name" required minLength={2} maxLength={80} placeholder="Studio North"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900" />
      </div>
      <div>
        <label htmlFor="workspace-slug" className="mb-2 block text-sm font-medium">Workspace URL</label>
        <input id="workspace-slug" name="slug" required minLength={3} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="studio-north"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900" />
      </div>
      {state.error ? <p role="alert" className="text-sm text-red-600 sm:col-span-2">{state.error}</p> : null}
      <button disabled={pending} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2">
        {pending ? "Creating…" : "Create workspace"}
      </button>
    </form>
  );
}
