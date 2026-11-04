import { getWorkspaceDashboardStats } from "@/server/queries/analytics";

const statusLabels = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
} as const;

export async function DashboardStats({ workspaceId }: { workspaceId: string }) {
  const stats = await getWorkspaceDashboardStats(workspaceId);
  const cards = [
    { label: "Active projects", value: stats.activeProjects },
    { label: "Overdue tasks", value: stats.overdueTasks },
    { label: "Pending reviews", value: stats.pendingReviews },
    { label: "Deliverable approval rate", value: stats.approvalRate === null ? "—" : `${stats.approvalRate}%` },
  ];

  return (
    <section aria-label="Workspace analytics" className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{card.value}</p>
          </article>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Tasks by status</h2>
          <p className="text-xs text-slate-500">Workspace-wide totals</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(stats.tasksByStatus).map(([status, count]) => (
            <div key={status} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{statusLabels[status as keyof typeof statusLabels]}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{count}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Approval rate is based on completed client review decisions ({stats.decidedReviews} total).
        </p>
      </section>
    </section>
  );
}

export function DashboardStatsFallback() {
  return (
    <section aria-label="Loading workspace analytics" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
      ))}
    </section>
  );
}
