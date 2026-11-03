import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/server/authz";

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/app");
  await requireWorkspaceMember(workspaceId);

  const entries = await getPrisma().activity.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });

  return <main className="mx-auto max-w-5xl px-6 py-10"><Link href="/app" className="text-sm font-medium text-indigo-600">← Dashboard</Link><h1 className="mt-5 text-3xl font-semibold">Activity</h1><p className="mt-2 text-slate-500">A workspace-scoped history of important changes.</p><div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">{entries.map((entry) => <article key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"><div><p className="font-medium">{entry.actor?.name ?? entry.actor?.email ?? "System"} <span className="font-normal text-slate-500">{entry.action.toLowerCase().replaceAll("_", " ")} {entry.entityType.toLowerCase()}</span></p><p className="mt-1 text-xs text-slate-500">{entry.createdAt.toLocaleString()}</p></div><span className="text-xs text-slate-400">{entry.entityId}</span></article>)}{!entries.length ? <p className="p-6 text-sm text-slate-500">No activity recorded yet.</p> : null}</div></main>;
}
