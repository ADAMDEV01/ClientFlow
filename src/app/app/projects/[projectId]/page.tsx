import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/server/authz";
import { CreateTaskForm, CreateMilestoneForm, CreateDeliverableForm, SubmitDeliverableForm } from "@/app/components/project-forms";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/app");
  await requireWorkspaceMember(workspaceId);

  const { projectId } = await params;
  const project = await getPrisma().project.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      id: true, name: true, description: true, status: true, dueDate: true,
      client: { select: { name: true, email: true } },
      milestones: { orderBy: { position: "asc" }, select: { id: true, name: true, dueDate: true, completedAt: true } },
      tasks: { orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, status: true, priority: true, visibleToClient: true, dueDate: true, assignee: { select: { name: true } } } },
      deliverables: { orderBy: [{ name: "asc" }, { version: "desc" }], select: { id: true, name: true, version: true, status: true, revision: true, updatedAt: true } },
    },
  });
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/app/projects" className="text-sm font-medium text-indigo-600">← Projects</Link>
      <header className="mt-5 border-b border-slate-200 pb-6 dark:border-slate-800"><p className="text-sm text-slate-500">{project.client.name} · {project.client.email}</p><h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>{project.description ? <p className="mt-3 max-w-2xl text-slate-500">{project.description}</p> : null}<p className="mt-3 text-sm text-slate-500">{project.status.toLowerCase().replace("_", " ")}{project.dueDate ? ` · Due ${project.dueDate.toLocaleDateString()}` : ""}</p></header>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Milestones</h2></div><CreateMilestoneForm workspaceId={workspaceId} projectId={project.id} /><div className="mt-3 space-y-2">{project.milestones.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.completedAt ? "Completed" : item.dueDate ? `Due ${item.dueDate.toLocaleDateString()}` : "No due date"}</p></div>)}{!project.milestones.length ? <p className="text-sm text-slate-500">No milestones yet.</p> : null}</div></section>
        <section><h2 className="text-lg font-semibold">Deliverables</h2><CreateDeliverableForm workspaceId={workspaceId} projectId={project.id} /><div className="mt-3 space-y-2">{project.deliverables.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p className="font-medium">{item.name} <span className="text-xs text-slate-500">v{item.version}</span></p><span className="text-xs text-slate-500">{item.status.toLowerCase().replace("_", " ")}</span>{item.status === "DRAFT" || item.status === "CHANGES_REQUESTED" ? <SubmitDeliverableForm workspaceId={workspaceId} deliverableId={item.id} revision={item.revision} /> : null}</div>)}{!project.deliverables.length ? <p className="text-sm text-slate-500">No deliverables yet.</p> : null}</div></section>
      </div>
      <section className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]"><CreateTaskForm workspaceId={workspaceId} projectId={project.id} /><div><h2 className="text-lg font-semibold">Tasks</h2><div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">{project.tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 last:border-0 dark:border-slate-800"><div><p className="font-medium">{task.title}</p><p className="text-xs text-slate-500">{task.assignee?.name ?? "Unassigned"} · {task.visibleToClient ? "Client visible" : "Internal only"}</p></div><span className="text-xs text-slate-500">{task.status.toLowerCase().replace("_", " ")} · {task.priority.toLowerCase()}</span></div>)}{!project.tasks.length ? <p className="p-4 text-sm text-slate-500">No tasks yet.</p> : null}</div></div></section>
    </main>
  );
}
