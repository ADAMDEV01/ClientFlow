import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/server/authz";
import { getWorkspaceActivity, getWorkspaceActivityOptions } from "@/server/queries/analytics";
import type { ActivityAction } from "@/generated/prisma/client";

const actions: ActivityAction[] = [
  "CREATED", "UPDATED", "DELETED", "INVITED", "ACCEPTED_INVITATION",
  "SUBMITTED", "APPROVED", "CHANGES_REQUESTED", "COMMENTED", "UPLOADED", "DOWNLOADED",
];

type SearchParams = Promise<{ project?: string; actor?: string; action?: string; cursor?: string }>;

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/app");
  await requireWorkspaceMember(workspaceId);

  const params = await searchParams;
  const options = await getWorkspaceActivityOptions(workspaceId);
  const action = actions.includes(params.action as ActivityAction) ? params.action as ActivityAction : undefined;
  const filters = {
    projectId: options.projects.some((item) => item.id === params.project) ? params.project : undefined,
    actorId: options.actors.some((item) => item.id === params.actor) ? params.actor : undefined,
    action,
    cursor: params.cursor,
  };
  const result = await getWorkspaceActivity(workspaceId, filters);

  const nextParams = new URLSearchParams();
  if (filters.projectId) nextParams.set("project", filters.projectId);
  if (filters.actorId) nextParams.set("actor", filters.actorId);
  if (filters.action) nextParams.set("action", filters.action);
  if (result.nextCursor) nextParams.set("cursor", result.nextCursor);
  const nextHref = `/app/activity?${nextParams.toString()}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/app" className="text-sm font-medium text-indigo-600">← Dashboard</Link>
      <h1 className="mt-5 text-3xl font-semibold">Activity log</h1>
      <p className="mt-2 text-slate-500">Filter and review changes made across this workspace.</p>

      <form method="get" className="mt-7 grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-4 dark:border-slate-800">
        <label className="text-sm font-medium">Project
          <select name="project" defaultValue={filters.projectId ?? ""} className="mt-2 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700">
            <option value="">All projects</option>
            {options.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Actor
          <select name="actor" defaultValue={filters.actorId ?? ""} className="mt-2 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700">
            <option value="">All team members</option>
            {options.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Action
          <select name="action" defaultValue={filters.action ?? ""} className="mt-2 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700">
            <option value="">All actions</option>
            {actions.map((item) => <option key={item} value={item}>{item.toLowerCase().replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Apply filters</button>
          <Link href="/app/activity" className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">Clear</Link>
        </div>
      </form>

      <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {result.entries.map((entry) => (
          <article key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div>
              <p className="font-medium">{entry.actor?.name ?? entry.actor?.email ?? "System"} <span className="font-normal text-slate-500">{entry.action.toLowerCase().replaceAll("_", " ")} {entry.entityType.toLowerCase()}</span></p>
              <p className="mt-1 text-xs text-slate-500">{entry.createdAt.toLocaleString()}</p>
            </div>
            <span className="text-xs text-slate-400">{entry.entityId}</span>
          </article>
        ))}
        {!result.entries.length ? <p className="p-6 text-sm text-slate-500">No activity matches these filters.</p> : null}
      </div>
      {result.hasMore && result.nextCursor ? <div className="mt-5 text-center"><Link href={nextHref} className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Load more activity</Link></div> : null}
    </main>
  );
}
