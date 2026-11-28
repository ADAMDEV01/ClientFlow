import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth-actions";
import { TeamNavigation } from "@/app/components/team-navigation";

export default async function TeamLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.workspaceId || session.user.role === "CLIENT") redirect("/portal");

  const accountName = session.user.name?.trim() || "Account";
  const initials = accountName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.02)] dark:border-slate-800 dark:bg-slate-950">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/app" className="flex items-center gap-2 text-lg font-bold tracking-tight text-indigo-700 dark:text-indigo-400">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-xs font-bold text-white">CF</span>
            ClientFlow
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <TeamNavigation />
            <details className="group relative">
              <summary aria-label="Account menu" className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-900 dark:hover:bg-slate-900 [&::-webkit-details-marker]:hidden">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{initials}</span>
                <span className="hidden max-w-28 truncate sm:block">{accountName}</span>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-slate-400"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{accountName}</p>
                  <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{session.user.email}</p>
                </div>
                <form action={logoutAction} className="pt-2">
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4"><path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8m4-3 4-4-4-4m4 4H7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
