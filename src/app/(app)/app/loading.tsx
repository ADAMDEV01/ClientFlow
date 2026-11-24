export default function AppLoading() {
  return (
    <main
      aria-label="Loading workspace"
      className="mx-auto max-w-6xl animate-pulse px-6 py-10"
    >
      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 h-9 w-56 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-slate-100 dark:bg-slate-900" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          />
        ))}
      </div>
      <div className="mt-8 h-64 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
    </main>
  );
}
