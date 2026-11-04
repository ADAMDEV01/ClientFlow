"use client";

import { useActionState } from "react";
import { UploadDeliverableForm } from "@/app/components/upload-deliverable-form";
import { createDeliverableFormAction, submitDeliverableFormAction, createNextVersionFormAction, type DeliverableFormState } from "@/app/actions/deliverable-actions";
import {
  createClientFormAction,
  createProjectPhase3FormAction,
  createTaskPhase3FormAction,
  createMilestonePhase3FormAction,
  type ProjectFormState,
  updateTaskStatusFormAction,
  type TaskStatusFormState,
} from "@/app/actions/project-actions";

const initialState: ProjectFormState = {};

function FormFeedback({ state }: { state: ProjectFormState }) {
  return state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : state.success ? <p role="status" className="text-sm text-emerald-600">{state.success}</p> : null;
}

const fieldClass = "w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700";

export function CreateClientForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(createClientFormAction, initialState);
  return <form action={action} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
    <input type="hidden" name="workspaceId" value={workspaceId} />
    <h2 className="font-semibold">Add a client</h2>
    <input name="name" required minLength={2} maxLength={120} placeholder="Client name" className={fieldClass} />
    <input name="email" type="email" required placeholder="Email address" className={fieldClass} />
    <input name="company" maxLength={120} placeholder="Company (optional)" className={fieldClass} />
    <FormFeedback state={state} />
    <button disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Adding…" : "Add client"}</button>
  </form>;
}

export function CreateProjectForm({ workspaceId, clients, members = [] }: { workspaceId: string; clients: { id: string; name: string }[]; members?: { userId: string; name: string | null; email: string }[] }) {
  const [state, action, pending] = useActionState(createProjectPhase3FormAction, initialState);
  return <form action={action} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
    <input type="hidden" name="workspaceId" value={workspaceId} />
    <h2 className="font-semibold">Create a project</h2>
    <input name="name" required minLength={2} maxLength={120} placeholder="Project name" className={fieldClass} />
    <select name="clientId" required className={fieldClass}><option value="">Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
    <textarea name="description" maxLength={5000} rows={2} placeholder="Project description (optional)" className={fieldClass} />
    <label className="grid gap-1 text-xs text-slate-500">Start date<input name="startDate" type="date" className={fieldClass} /></label>
    <label className="grid gap-1 text-xs text-slate-500">Due date<input name="dueDate" type="date" className={fieldClass} /></label>
    <label className="grid gap-1 text-xs text-slate-500">Optional budget<input name="budget" type="number" min="0" step="0.01" placeholder="0.00" className={fieldClass} /></label>
    {members.length ? <fieldset className="grid gap-2"><legend className="text-xs font-medium text-slate-500">Project members</legend>{members.map(member => <label key={member.userId} className="flex items-center gap-2 text-sm"><input type="checkbox" name="memberIds" value={member.userId} defaultChecked />{member.name ?? member.email}</label>)}</fieldset> : null}
    <FormFeedback state={state} />
    <button disabled={pending || clients.length === 0} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Creating…" : "Create project"}</button>
    {clients.length === 0 ? <p className="text-xs text-slate-500">Add a client before creating a project.</p> : null}
  </form>;
}

export function CreateTaskForm({ workspaceId, projectId, members = [] }: { workspaceId: string; projectId: string; members?: { userId: string; name: string | null; email: string }[] }) {
  const [state, action, pending] = useActionState(createTaskPhase3FormAction, initialState);
  return <form action={action} className="grid gap-3 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
    <input type="hidden" name="workspaceId" value={workspaceId} />
    <input type="hidden" name="projectId" value={projectId} />
    <h2 className="font-semibold">Add a task</h2>
    <input name="title" required minLength={2} maxLength={160} placeholder="Task title" className={fieldClass} />
    <textarea name="description" rows={2} maxLength={5000} placeholder="Description (optional)" className={fieldClass} />
    <select name="assigneeId" className={fieldClass}><option value="">Unassigned</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.name ?? member.email}</option>)}</select>
    <select name="priority" defaultValue="MEDIUM" className={fieldClass}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select>
    <select name="status" defaultValue="TODO" className={fieldClass}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select>
    <input name="dueDate" type="date" className={fieldClass} />
    <label className="flex items-center gap-2 text-sm"><input name="visibleToClient" type="checkbox" /> Visible to client</label>
    <FormFeedback state={state} />
    <button disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Adding…" : "Add task"}</button>
  </form>;
}

export function CreateMilestoneForm({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const [state, action, pending] = useActionState(createMilestonePhase3FormAction, initialState);
  return <form action={action} className="grid gap-3 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
    <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="projectId" value={projectId} />
    <h2 className="font-semibold">Add a milestone</h2>
    <input name="name" required minLength={2} maxLength={120} placeholder="Milestone name" className={fieldClass} />
    <textarea name="description" rows={2} placeholder="Description (optional)" className={fieldClass} />
    <input name="dueDate" type="date" className={fieldClass} />
    <select name="status" defaultValue="PENDING" className={fieldClass}><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select>
    <input name="position" type="number" min="0" placeholder="Order (optional)" className={fieldClass} />
    <FormFeedback state={state} />
    <button disabled={pending} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">{pending ? "Adding…" : "Add milestone"}</button>
  </form>;
}

export function CreateDeliverableForm({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const [state, action, pending] = useActionState(createDeliverableFormAction, initialState);
  return <form action={action} className="grid gap-3 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
    <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="projectId" value={projectId} />
    <h2 className="font-semibold">Create a deliverable draft</h2>
    <input name="name" required minLength={2} maxLength={160} placeholder="Deliverable name" className={fieldClass} />
    <textarea name="description" rows={2} maxLength={3000} placeholder="Description (optional)" className={fieldClass} />
    <FormFeedback state={state} />
    <button disabled={pending} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">{pending ? "Creating…" : "Create draft"}</button>
  </form>;
}

export function SubmitDeliverableForm({ workspaceId, deliverableId, revision }: { workspaceId: string; deliverableId: string; revision: number }) {
  const [state, action, pending] = useActionState(submitDeliverableFormAction, initialState);
  return <form action={action} className="mt-3">
    <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="deliverableId" value={deliverableId} /><input type="hidden" name="expectedRevision" value={revision} />
    <FormFeedback state={state} />
    <button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{pending ? "Submitting…" : "Submit for review"}</button>
  </form>;
}

export function TaskStatusForm({ workspaceId, taskId, status }: { workspaceId: string; taskId: string; status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" }) {
  const [state, action, pending] = useActionState(updateTaskStatusFormAction, {} as TaskStatusFormState);
  return <form action={action} className="flex items-center gap-2">
    <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="taskId" value={taskId} />
    <select name="status" defaultValue={status} aria-label="Task status" className="rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-xs dark:border-slate-700">
      <option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="IN_REVIEW">In review</option><option value="DONE">Done</option>
    </select>
    <button disabled={pending} className="text-xs font-semibold text-indigo-600 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
    {state.error ? <span role="alert" className="text-xs text-red-600">{state.error}</span> : null}
  </form>;
}

export function CreateNextVersionForm({ workspaceId, projectId, deliverableId }: { workspaceId: string; projectId: string; deliverableId: string }) {
  const [state, action, pending] = useActionState(createNextVersionFormAction, {} as DeliverableFormState);
  return <>
    <form action={action} className="mt-3">
      <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="deliverableId" value={deliverableId} />
      <FormFeedback state={state} />
      <button disabled={pending} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">{pending ? "Creating…" : "Create next version"}</button>
    </form>
    {state.deliverableId ? <UploadDeliverableForm workspaceId={workspaceId} projectId={projectId} deliverableId={state.deliverableId} /> : null}
  </>;
}
