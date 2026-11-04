import Link from "next/link";
import { auth } from "@/auth";

const features = [
  { title: "One workspace", description: "Keep clients, projects, milestones, and team activity organized together." },
  { title: "Client-ready visibility", description: "Share progress without exposing internal tasks or private team discussions." },
  { title: "Clear approvals", description: "Send versioned deliverables for review and keep every decision traceable." },
];

export default async function HomePage() {
  const session = await auth();
  return (
    <main className="min-h-screen">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-indigo-600">ClientFlow</Link>
        <div className="flex items-center gap-3">
          {session?.user?.id ? <Link href="/app" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">Open workspace</Link> : <><Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold">Sign in</Link><Link href="/register" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">Get started</Link></>}
        </div>
      </nav>
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-20 sm:pt-28">
        <p className="text-sm font-bold tracking-[0.2em] text-indigo-600 uppercase">Client and project management</p>
        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-7xl">Client work, <span className="text-indigo-600">without the chaos.</span></h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">A calm, secure space for freelancers and small agencies to manage projects, keep clients informed, and move deliverables forward with confidence.</p>
        <div className="mt-10 flex flex-wrap gap-3"><Link href={session?.user?.id ? "/app" : "/register"} className="rounded-xl bg-indigo-600 px-6 py-3.5 font-semibold text-white">Start with ClientFlow</Link><Link href="/login" className="rounded-xl border border-slate-300 px-6 py-3.5 font-semibold dark:border-slate-700">I already have an account</Link></div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-24 md:grid-cols-3">
        {features.map((feature, index) => <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-950"><p className="text-sm font-semibold text-indigo-600">0{index + 1}</p><h2 className="mt-5 text-xl font-semibold">{feature.title}</h2><p className="mt-3 leading-7 text-slate-500">{feature.description}</p></article>)}
      </section>
    </main>
  );
}
