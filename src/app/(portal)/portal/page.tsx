import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";

export default async function ClientPortalHome() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "CLIENT" || !session.user.clientId) redirect("/login");
  const projects = await getPrisma().project.findMany({
    where: { workspaceId: session.user.workspaceId ?? undefined, clientId: session.user.clientId, client: { userId: session.user.id } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, workspaceId: true, name: true, status: true, updatedAt: true },
  });
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm font-semibold text-indigo-600">CLIENT PORTAL</p>
      <h1 className="mt-3 text-3xl font-semibold">Your projects</h1>
      <p className="mt-2 text-slate-500">Track progress and review shared deliverables.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {projects.map((project) => <Link key={project.id} href={`/portal/${project.id}`} className="rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 dark:border-slate-800"><h2 className="font-semibold">{project.name}</h2><p className="mt-2 text-sm text-slate-500">{project.status.toLowerCase().replace("_", " ")}</p></Link>)}
        {!projects.length ? <p className="text-sm text-slate-500">No projects have been shared with you yet.</p> : null}
      </div>
    </main>
  );
}
