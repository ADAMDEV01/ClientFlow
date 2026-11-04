import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { WorkspaceForm } from "@/app/components/workspace-form";
import { DashboardStats, DashboardStatsFallback } from "@/app/components/dashboard-stats";
import { logoutAction } from "@/app/actions/auth-actions";

export default async function AppHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const prisma = getPrisma();
  const membership = session.user.workspaceId
    ? await prisma.workspaceMember.findFirst({
        where: { workspaceId: session.user.workspaceId, userId: session.user.id },
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              projects: {
                orderBy: { updatedAt: "desc" },
                take: 5,
                select: { id: true, name: true, status: true, updatedAt: true, client: { select: { name: true } } },
              },
              _count: { select: { clients: true, projects: true, members: true } },
            },
          },
        },
      })
    : null;

  if (!membership) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-sm font-bold tracking-wide text-indigo-600">CLIENTFLOW</p>
        <h1 className="mt-5 text-3xl font-semibold">Create your workspace</h1>
        <p className="mt-2 text-slate-500">Your workspace is where your team, clients, and projects live.</p>
        <WorkspaceForm />
      </main>
    );
  }

  const workspace = membership.workspace;
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div><p className="text-sm font-bold tracking-wide text-indigo-600">CLIENTFLOW</p><h1 className="mt-2 text-2xl font-semibold">{workspace.name}</h1><p className="text-sm text-slate-500">{membership.role.toLowerCase()} workspace</p></div>
        <form action={logoutAction}><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">Sign out</button></form>
      </header>
      <Suspense fallback={<DashboardStatsFallback />}>
        <DashboardStats workspaceId={workspace.id} />
      </Suspense>
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Projects", value: workspace._count.projects },
          { label: "Clients", value: workspace._count.clients },
          { label: "Team members", value: workspace._count.members },
        ].map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950"><p className="text-sm text-slate-500">{item.label}</p><p className="mt-3 text-3xl font-semibold">{item.value}</p></div>)}
      </section>
      <section className="mt-10">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent projects</h2><Link href="/app/projects" className="text-sm font-semibold text-indigo-600">View all</Link></div>
        <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
          {workspace.projects.length ? workspace.projects.map((project) => <Link key={project.id} href={`/app/projects/${project.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-900"><div><p className="font-medium">{project.name}</p><p className="text-sm text-slate-500">{project.client.name}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium dark:bg-slate-800">{project.status.replace("_", " ").toLowerCase()}</span></Link>) : <p className="px-5 py-8 text-sm text-slate-500">No projects yet. Your projects will appear here.</p>}
        </div>
      </section>
    </main>
  );
}
