import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loginAction } from "@/app/actions/auth-actions";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/app");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <Link href="/" className="text-sm font-bold tracking-wide text-indigo-600">CLIENTFLOW</Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to continue to your workspace.</p>
        <form action={loginAction} className="mt-8 space-y-5">
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
          <button className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500">Sign in</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">New to ClientFlow? <Link href="/register" className="font-semibold text-indigo-600">Create an account</Link></p>
      </section>
    </main>
  );
}
