import { getWorkspaceDashboardStats } from "@/server/queries/analytics";

const statusLabels = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
} as const;

const statusColors = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  IN_REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
} as const;

function MetricIcon({ kind }: { kind: "projects" | "overdue" | "reviews" | "approval" }) {
  const paths = {
    projects: <><path d="M3.5 7.5h17v12h-17z" /><path d="M8 7.5V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8v1.7M3.5 12h17M10 12v2h4v-2" /></>,
    overdue: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.3 2" /></>,
    reviews: <><path d="M7 4.5h7l4 4V20H7z" /><path d="M14 4.5V9h4M9.5 14l1.8 1.8 3.5-3.6" /></>,
    approval: <><circle cx="12" cy="12" r="8.5" /><path d="m8 12.2 2.5 2.5 5.5-5.8" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">{paths[kind]}</svg>;
}

export async function DashboardStats({
  workspaceId,
  clientCount,
  projectCount,
  firstProjectId,
}: {
  workspaceId: string;
  clientCount: number;
  projectCount: number;
  firstProjectId: string | null;
}) {
  const stats = await getWorkspaceDashboardStats(workspaceId);
  const taskCount = Object.values(stats.tasksByStatus).reduce((total, count) => total + count, 0);
  const steps = [
    {
      title: "Add your first client",
      description: "Save the people and companies you work with.",
      complete: clientCount > 0,
      href: "/app/clients",
      action: clientCount > 0 ? "View clients" : "Add a client",
    },
    {
      title: "Create your first project",
      description: "Connect a client to a project and its milestones.",
      complete: projectCount > 0,
      href: "/app/projects",
      action: projectCount > 0 ? "View projects" : "Create a project",
    },
    {
      title: "Add your first task",
      description: "Open a project and assign the next piece of work.",
      complete: taskCount > 0,
      href: firstProjectId ? `/app/projects/${firstProjectId}` : "/app/projects",
      action: taskCount > 0 ? "View tasks" : firstProjectId ? "Add a task" : "Create a project first",
    },
  ];
  const completedSteps = steps.filter((step) => step.complete).length;
  const cards = [
    { label: "Active projects", value: stats.activeProjects, icon: "projects" as const, tone: "indigo" },
    { label: "Overdue tasks", value: stats.overdueTasks, icon: "overdue" as const, tone: stats.overdueTasks > 0 ? "danger" : "slate" },
    { label: "Pending reviews", value: stats.pendingReviews, icon: "reviews" as const, tone: "amber" },
    { label: "Deliverable approval rate", value: stats.approvalRate === null ? "—" : `${stats.approvalRate}%`, icon: "approval" as const, tone: "emerald" },
  ];

  return (
    <section aria-label="Workspace analytics" className="mt-8 space-y-7">
      {completedSteps < steps.length ? (
        <section aria-labelledby="getting-started-title" className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white p-5 shadow-[0_12px_35px_rgba(79,70,229,0.07)] dark:border-indigo-900/70 dark:from-indigo-950/50 dark:via-slate-950 dark:to-slate-950 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-700 dark:text-indigo-300">Getting started</p>
              <h2 id="getting-started-title" className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Build your workspace step by step</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Add a client, create a project, then add the first task. Your dashboard will fill in as work moves forward.</p>
            </div>
            <span className="rounded-full border border-indigo-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300">{completedSteps} of 3 complete</span>
          </div>
          <ol className="mt-5 grid gap-3 lg:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200/90 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <span className={step.complete ? "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"}>
                  {step.complete ? <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4"><path d="m4 10 4 4 8-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : <span className="text-xs font-bold">{index + 1}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{step.description}</p>
                  {step.complete ? (
                    <span className="mt-3 inline-flex text-xs font-semibold text-emerald-700 dark:text-emerald-300">Completed</span>
                  ) : (
                    <Link href={step.href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-300">{step.action}<span aria-hidden="true">→</span></Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className={
              "rounded-2xl border p-5 shadow-[0_8px_28px_rgba(15,23,42,0.055)] transition-shadow hover:shadow-[0_12px_32px_rgba(15,23,42,0.09)] dark:bg-slate-950 dark:shadow-none " +
              (card.tone === "danger"
                ? "border-rose-200 bg-rose-50/70 dark:border-rose-900/70 dark:bg-rose-950/25"
                : "border-slate-300 bg-white dark:border-slate-700")
            }
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{card.label}</p>
              <span className={
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                (card.tone === "danger" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  : card.tone === "indigo" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : card.tone === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : card.tone === "emerald" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")
              }>
                <MetricIcon kind={card.icon} />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">{card.value}</p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,0.045)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-950 dark:text-white">Tasks by status</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">Workspace-wide totals</p>
        </div>
        <div className="mt-5 grid gap-x-6 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(stats.tasksByStatus).map(([status, count]) => (
            <div key={status} className="flex items-center gap-3 border-t border-slate-100 py-4 dark:border-slate-800">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColors[status as keyof typeof statusColors] ?? "bg-slate-400"}`} />
              <p className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{statusLabels[status as keyof typeof statusLabels]}</p>
              <p className="text-lg font-semibold tabular-nums text-slate-950 dark:text-white">{count}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-400">
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
