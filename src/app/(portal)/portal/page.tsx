import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getClientPortalProjects } from "@/server/queries/client-portal";

export default async function ClientPortalHome() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "CLIENT" || !session.user.clientId || !session.user.workspaceId) redirect("/login");
  const projects = await getClientPortalProjects();
  return <main className="mx-auto max-w-5xl px-6 py-10">
    <p className="text-sm font-semibold text-indigo-600">CLIENT PORTAL</p>
    <h1 className="mt-3 text-3xl font-semibold">Your projects</h1>
    <p className="mt-2 text-slate-500">Track progress and review shared deliverables.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {projects.map(project => <Link key={project.id} href={`/portal/${project.id}`} className="rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{project.name}</h2><span className="text-xs text-slate-500">{project.progress}%</span></div><p className="mt-2 text-sm text-slate-500">{project.status.toLowerCase().replace("_", " ")}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${project.progress}%` }} /></div></Link>)}
      {!projects.length ? <p className="text-sm text-slate-500">No projects have been shared with you yet.</p> : null}
    </div>
  </main>;
}
