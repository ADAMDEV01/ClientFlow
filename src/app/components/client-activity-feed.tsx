type ClientActivityItem = {
  id: string;
  action: string;
  entityType: string;
  projectName: string;
  createdAt: Date;
  actorName: string;
};

export function ClientActivityFeed({ entries }: { entries: ClientActivityItem[] }) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Recent activity</h2>
          <p className="mt-1 text-sm text-slate-500">Updates from projects shared with you.</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {entries.map((entry) => (
          <article key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-sm font-medium">{entry.actorName} <span className="font-normal text-slate-500">{entry.action.toLowerCase().replaceAll("_", " ")} {entry.entityType.toLowerCase()}</span></p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{entry.projectName}</p>
            </div>
            <time className="text-xs text-slate-500" dateTime={entry.createdAt.toISOString()}>{entry.createdAt.toLocaleString()}</time>
          </article>
        ))}
        {!entries.length ? <p className="p-5 text-sm text-slate-500">No recent project activity.</p> : null}
      </div>
    </section>
  );
}
