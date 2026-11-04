import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/app/components/auth-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect(session.user.role === "CLIENT" ? "/portal" : "/app");
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <Link href="/" className="text-sm font-bold tracking-wide text-indigo-600">CLIENTFLOW</Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to continue to your workspace.</p>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-slate-500">New to ClientFlow? <Link href="/register" className="font-semibold text-indigo-600">Create an account</Link></p>
      </section>
    </main>
  );
}
