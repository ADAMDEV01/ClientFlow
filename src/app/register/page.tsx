import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/app/components/auth-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) redirect(session.user.role === "CLIENT" ? "/portal" : "/app");
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <Link href="/" className="text-sm font-bold tracking-wide text-indigo-600">CLIENTFLOW</Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-slate-500">Start organizing client work in one place.</p>
        <RegisterForm />
      </section>
    </main>
  );
}
