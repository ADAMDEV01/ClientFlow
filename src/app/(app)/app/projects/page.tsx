import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/server/authz";
import { CreateProjectForm } from "@/app/components/project-forms";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/app");
  await requireWorkspaceMember(workspaceId);

  const prisma = getPrisma();
  const [projects, clients, members] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true, name: true, status: true, dueDate: true,
        client: { select: { name: true } },
        _count: { select: { tasks: true, deliverables: true } },
      },
    }),
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true, user: { select: { name: true, email: true } } } }).then(rows => rows.map(row => ({ userId: row.userId, name: row.user.name, email: row.user.email }))),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/app" className="text-sm font-medium text-indigo-600">← Dashboard</Link>
      <h1 className="mt-5 text-3xl font-semibold">Projects</h1>
      <p className="mt-2 text-slate-500">Projects belonging to this workspace.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]"><CreateProjectForm workspaceId={workspaceId} clients={clients} members={members} /><div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => <Link key={project.id} href={`/app/projects/${project.id}`} className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start justify-between gap-4"><h2 className="font-semibold">{project.name}</h2><span className="text-xs text-slate-500">{project.status.toLowerCase()}</span></div><p className="mt-2 text-sm text-slate-500">{project.client.name}</p><div className="mt-6 flex gap-5 text-xs text-slate-500"><span>{project._count.tasks} tasks</span><span>{project._count.deliverables} deliverables</span><span>{project.dueDate ? `Due ${project.dueDate.toLocaleDateString()}` : "No due date"}</span></div></Link>)}
        {!projects.length ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-500 dark:border-slate-700">No projects yet.</p> : null}
      </div></div>
    </main>
  );
}
