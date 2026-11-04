import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getClientProjectPortal } from "@/server/queries/client-portal";
import { submitClientReviewAction, addClientDeliverableCommentAction } from "@/app/actions/deliverable-actions";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CLIENT" || !session.user.workspaceId) notFound();

  const { projectId } = await params;
  const project = await getClientProjectPortal(session.user.workspaceId, projectId);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/" className="text-sm font-bold tracking-wide text-indigo-600">CLIENTFLOW PORTAL</Link>
      <header className="mt-8 border-b border-slate-200 pb-6 dark:border-slate-800">
        <p className="text-sm text-slate-500">Project overview</p>
        <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
        {project.description ? <p className="mt-3 max-w-2xl text-slate-500">{project.description}</p> : null}
        <p className="mt-4 text-sm text-slate-500">Status: {project.status.toLowerCase().replace("_", " ")}</p><div className="mt-5"><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Project progress</span><span>{project.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${project.progress}%` }} /></div></div>
      </header>
      <section className="mt-9">
        <h2 className="text-xl font-semibold">Milestones</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {project.milestones.map((milestone) => <article key={milestone.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><h3 className="font-medium">{milestone.name}</h3><p className="mt-2 text-sm text-slate-500">{milestone.status.toLowerCase().replace("_", " ")}{milestone.dueDate ? ` · Due ${milestone.dueDate.toLocaleDateString()}` : ""}</p></article>)}
          {!project.milestones.length ? <p className="text-sm text-slate-500">No milestones have been shared yet.</p> : null}
        </div>
      </section>
      <section className="mt-9">
        <h2 className="text-xl font-semibold">Shared tasks</h2>
        <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {project.tasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-4 px-4 py-3"><div><p className="font-medium">{task.title}</p><p className="text-xs text-slate-500">{task.dueDate ? `Due ${task.dueDate.toLocaleDateString()}` : "No due date"}</p></div><span className="text-xs text-slate-500">{task.status.toLowerCase().replace("_", " ")}</span></div>)}
          {!project.tasks.length ? <p className="p-4 text-sm text-slate-500">No shared tasks yet.</p> : null}
        </div>
      </section>
      <section className="mt-9">
        <h2 className="text-xl font-semibold">Deliverables</h2>
        <div className="mt-4 space-y-4">
          {project.deliverables.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{item.name} <span className="text-xs font-normal text-slate-500">v{item.version}</span></h3><p className="mt-1 text-sm text-slate-500">{item.description ?? item.fileName ?? "Project deliverable"}</p>{item.fileName ? <a href={`/api/workspaces/${project.workspaceId}/deliverables/${item.id}/download`} className="mt-2 inline-block text-xs font-semibold text-indigo-600">Download file</a> : null}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">{item.status.toLowerCase().replace("_", " ")}</span></div>
            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <h4 className="text-sm font-semibold">Discussion</h4>
              {item.comments.map(comment => <div key={comment.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900"><p>{comment.body}</p><p className="mt-1 text-xs text-slate-500">{comment.author.name ?? "ClientFlow user"} · v{comment.version} · {comment.createdAt.toLocaleString()}</p></div>)}
              <form action={addClientDeliverableCommentAction} className="space-y-2">
                <input type="hidden" name="workspaceId" value={project.workspaceId} />
                <input type="hidden" name="deliverableId" value={item.id} />
                <textarea name="body" required maxLength={4000} rows={2} placeholder="Add a comment…" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Post comment</button>
              </form>
            </div>
            {item.reviews.map(review => <div key={review.id} className="mt-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><p className="font-medium">{review.decision.replace("_", " ")} · v{review.version}</p>{review.feedback ? <p className="mt-1 text-slate-600 dark:text-slate-300">{review.feedback}</p> : null}<p className="mt-1 text-xs text-slate-500">{review.reviewer.name ?? "Reviewer"} · {review.createdAt.toLocaleString()}</p></div>)}
            {item.status === "SUBMITTED" ? <form action={submitClientReviewAction} className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <input type="hidden" name="workspaceId" value={project.workspaceId} />
              <input type="hidden" name="deliverableId" value={item.id} />
              <input type="hidden" name="expectedRevision" value={item.revision} />
              <label className="block text-sm font-medium" htmlFor={`feedback-${item.id}`}>Feedback (required when requesting changes)</label>
              <textarea id={`feedback-${item.id}`} name="feedback" rows={3} maxLength={4000} placeholder="Share any changes you would like…" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
              <div className="flex flex-wrap gap-2"><button name="decision" value="APPROVED" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Approve</button><button name="decision" value="CHANGES_REQUESTED" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Request changes</button></div>
            </form> : null}
          </article>)}
          {!project.deliverables.length ? <p className="text-sm text-slate-500">No deliverables have been shared yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
