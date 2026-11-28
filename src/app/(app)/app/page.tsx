import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { WorkspaceForm } from "@/app/components/workspace-form";
import { DashboardStats, DashboardStatsFallback } from "@/app/components/dashboard-stats";

function titleCase(value: string) {
  return value.trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roleLabel(role: string) {
  return role.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
      <main className="mx-auto max-w-7xl px-6 py-20">
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">Create your workspace</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Your workspace is where your team, clients, and projects live.</p>
        <WorkspaceForm />
      </main>
    );
  }

  const workspace = membership.workspace;
  const workspaceTitle = titleCase(workspace.name);
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{workspaceTitle}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{roleLabel(membership.role)} workspace</p>
        </div>
        <Link href="/app/projects" className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500">Create project</Link>
      </header>
      <Suspense fallback={<DashboardStatsFallback />}>
        <DashboardStats
          workspaceId={workspace.id}
          clientCount={workspace._count.clients}
          projectCount={workspace._count.projects}
          firstProjectId={workspace.projects[0]?.id ?? null}
        />
      </Suspense>
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Recent projects</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">The latest work in {workspaceTitle}.</p>
          </div>
          <Link href="/app/projects" className="text-sm font-semibold text-indigo-700 hover:text-indigo-600 dark:text-indigo-300">View all projects</Link>
        </div>
        <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-300 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.045)] dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:shadow-none">
          {workspace.projects.length ? workspace.projects.map((project) => (
            <Link key={project.id} href={`/app/projects/${project.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-900">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{project.name}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{project.client.name}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">{project.status.replace("_", " ").toLowerCase()}</span>
            </Link>
          )) : (
            <div className="px-5 py-9 text-center">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">No projects yet</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Create your first project to start organizing tasks and deliverables.</p>
              <Link href="/app/projects" className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500">Create your first project</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
