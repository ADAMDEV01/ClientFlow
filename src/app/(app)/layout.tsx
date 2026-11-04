import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth-actions";

export default async function TeamLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.workspaceId || session.user.role === "CLIENT") redirect("/portal");
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/app" className="text-lg font-bold tracking-tight text-indigo-600">ClientFlow</Link>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/app">Overview</Link><Link href="/app/projects">Projects</Link>
            <Link href="/app/clients">Clients</Link><Link href="/app/team">Team</Link>
            <Link href="/app/activity">Activity</Link><Link href="/app/settings">Settings</Link>
            <form action={logoutAction}><button className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700">Sign out</button></form>
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
