"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/actions/auth-actions";

const initialState: FormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);
  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium">Full name</label>
        <input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </div>
      <div>
        <label htmlFor="workspaceName" className="mb-2 block text-sm font-medium">Workspace name</label>
        <input id="workspaceName" name="workspaceName" required minLength={2} maxLength={80} placeholder="My Studio"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </div>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        <p className="mt-2 text-xs text-slate-500">Use at least 12 characters.</p>
      </div>
      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      <button disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-500">Already registered? <Link href="/login" className="font-semibold text-indigo-600">Sign in</Link></p>
    </form>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(
    async (_previous: FormState, formData: FormData) => {
      const { loginAction } = await import("@/app/actions/auth-actions");
      return loginAction(_previous, formData);
    },
    initialState,
  );
  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </div>
      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      <button disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
