import Link from "next/link";
import { auth } from "@/auth";

const features = [
  { number: "01", title: "One workspace", description: "Keep clients, projects, milestones, and team activity organized together." },
  { number: "02", title: "Client-ready visibility", description: "Share progress without exposing internal tasks or private team discussions." },
  { number: "03", title: "Clear approvals", description: "Send versioned deliverables for review and keep every decision traceable." },
];

function WorkspacePreview() {
  return (
    <section aria-label="Illustrative workspace preview" className="relative mx-auto w-full max-w-[620px]">
      <div aria-hidden="true" className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-indigo-200/60 blur-3xl dark:bg-indigo-900/25" />
      <div className="overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white p-3 shadow-[0_28px_90px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-950 sm:p-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-2 pb-3 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xs font-bold text-white">CF</span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">ClientFlow</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Sample workspace</p>
            </div>
          </div>
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[9px] font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">Illustrative preview</span>
        </div>
        <div className="grid gap-3 pt-3 sm:grid-cols-[120px_1fr]">
          <aside className="hidden rounded-xl bg-slate-50 p-3 dark:bg-slate-900 sm:block">
            <p className="px-2 pb-3 text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">Workspace</p>
            <div className="space-y-1 text-[10px]">
              <p className="rounded-lg bg-indigo-100 px-2.5 py-2 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Overview</p>
              <p className="px-2.5 py-2 text-slate-500 dark:text-slate-400">Projects</p>
              <p className="px-2.5 py-2 text-slate-500 dark:text-slate-400">Clients</p>
              <p className="px-2.5 py-2 text-slate-500 dark:text-slate-400">Activity</p>
            </div>
          </aside>
          <div className="min-w-0 space-y-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[.14em] text-indigo-600">Overview</p>
                <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white sm:text-base">Your workspace</h2>
              </div>
              <span className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[9px] font-semibold text-white">New project</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[["03", "Projects"], ["05", "Open tasks"], ["02", "Reviews"]].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white sm:text-lg">{value}</p>
                  <p className="mt-1 text-[9px] text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">Recent projects</p>
                <p className="text-[9px] font-medium text-indigo-600">View all</p>
              </div>
              <div className="space-y-3">
                {[
                  ["Website refresh", "Design & delivery", "72%", "w-[72%]"],
                  ["Brand identity", "Client review", "48%", "w-[48%]"],
                  ["Monthly report", "In progress", "30%", "w-[30%]"],
                ].map(([name, phase, value, width]) => (
                  <div key={name} className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-[9px] font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">{name.slice(0, 1)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[9px] font-semibold text-slate-800 dark:text-slate-200">{name}</p>
                        <span className="text-[8px] text-slate-500">{value}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full bg-indigo-500 ${width}`} /></div>
                      <p className="mt-1 text-[8px] text-slate-400">{phase}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="px-1 text-center text-[9px] text-slate-400">Sample interface · illustrative content only</p>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:block">
        <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">A clear workflow</p>
        <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">Client → Project → Delivery</p>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const session = await auth();
  const primaryHref = session?.user?.id ? "/app" : "/register";

  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5 sm:py-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-indigo-700 dark:text-indigo-400">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-xs font-bold text-white">CF</span>
          ClientFlow
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {session?.user?.id ? (
            <Link href="/app" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 sm:px-5">Open workspace</Link>
          ) : (
            <>
              <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900">Sign in</Link>
              <Link href={primaryHref} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 sm:px-5">Get started</Link>
            </>
          )}
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)] lg:gap-12 lg:pb-28 lg:pt-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-300">
            For freelancers and small agencies
          </p>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight text-slate-950 dark:text-white sm:text-6xl xl:text-7xl">
            Client work,
            <span className="block text-indigo-600 dark:text-indigo-400">without the chaos.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            A calm, secure space to organize clients, coordinate projects, track tasks, and move deliverables through review with confidence.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href={primaryHref} className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-500">
              Get started
            </Link>
            <Link href="#workflow" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white/70 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:border-indigo-700">
              Explore the workflow
            </Link>
          </div>
          <p className="mt-6 text-xs leading-6 text-slate-500 dark:text-slate-400">
            Keep internal work organized while giving clients a clear view of the progress that matters to them.
          </p>
        </div>
        <WorkspacePreview />
      </section>

      <section id="workflow" className="border-y border-slate-200 bg-slate-50/80 py-14 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600 dark:text-indigo-400">A connected workflow</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">From first conversation to approved delivery</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">Designed around the work freelancers and small teams coordinate every day — without inventing activity or hiding the details.</p>
          </div>
          <div className="mt-9 grid gap-3 sm:grid-cols-4">
            {[
              ["01", "Client", "Keep contact and company details together."],
              ["02", "Project", "Set ownership, milestones, and due dates."],
              ["03", "Task", "Track the work and who is responsible."],
              ["04", "Delivery", "Share versions and record review decisions."],
            ].map(([number, title, description], index) => (
              <article key={title} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] dark:border-slate-700 dark:bg-slate-950">
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{number}</p>
                <h3 className="mt-3 text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
                {index < 3 ? <span aria-hidden="true" className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rotate-45 border-r border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 sm:block" /> : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-20 md:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-slate-300 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.055)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.09)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-none">
            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{feature.number}</p>
            <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{feature.title}</h2>
            <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">{feature.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
