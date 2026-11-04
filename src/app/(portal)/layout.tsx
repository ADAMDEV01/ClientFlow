import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth-actions";

export default async function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CLIENT") redirect("/app");
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/portal" className="font-bold tracking-tight text-indigo-600">CLIENTFLOW CLIENT PORTAL</Link>
          <form action={logoutAction}><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">Sign out</button></form>
        </nav>
      </header>
      {children}
    </div>
  );
}
