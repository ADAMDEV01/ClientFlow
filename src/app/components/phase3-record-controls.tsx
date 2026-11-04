"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  saveClientAction, deleteClientAction, saveProjectAction, deleteProjectAction,
  saveMilestoneAction, deleteMilestoneAction, saveTaskAction, deleteTaskAction,
} from "@/app/actions/phase3-actions";

const field = "w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700";
type Member = { userId: string; name: string | null; email: string };

function useRecordAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function execute(action: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? "Saved successfully." : result.error?.message ?? "Unable to save.");
      if (result.ok) router.refresh();
    });
  }
  return { pending, message, execute };
}

export function ClientRecordControls({ workspaceId, client }: { workspaceId: string; client: { id: string; name: string; email: string; company: string | null; phone: string | null } }) {
  const { pending, message, execute } = useRecordAction();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    execute(() => saveClientAction(workspaceId, { name: fd.get("name"), email: fd.get("email"), company: fd.get("company") || undefined, phone: fd.get("phone") || undefined }, client.id));
  }
  return <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-indigo-600">Edit client</summary>
    <form onSubmit={submit} className="mt-3 grid gap-2">
      <input className={field} name="name" defaultValue={client.name} required minLength={2} />
      <input className={field} name="email" type="email" defaultValue={client.email} required />
      <input className={field} name="company" defaultValue={client.company ?? ""} placeholder="Company" />
      <input className={field} name="phone" defaultValue={client.phone ?? ""} placeholder="Phone" />
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-white disabled:opacity-50">Save client</button>
    </form>
    <button disabled={pending || client.id.length === 0} onClick={() => { if (confirm("Delete this client? Clients with projects cannot be deleted.")) execute(() => deleteClientAction(workspaceId, client.id)); }} className="mt-2 text-red-600">Delete client</button>
    {message ? <p role="status" className="mt-2 text-xs text-slate-500">{message}</p> : null}
  </details>;
}

export function ProjectRecordControls({ workspaceId, project, clients, members }: { workspaceId: string; project: { id: string; name: string; description: string | null; clientId: string; startDate: Date | null; dueDate: Date | null; budget: string | null; memberIds: string[] }; clients: { id: string; name: string }[]; members: Member[] }) {
  const { pending, message, execute } = useRecordAction();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    execute(() => saveProjectAction(workspaceId, { name: fd.get("name"), description: fd.get("description") || undefined, clientId: fd.get("clientId"), startDate: fd.get("startDate") || undefined, dueDate: fd.get("dueDate") || undefined, budget: fd.get("budget") || undefined, memberIds: fd.getAll("memberIds").map(String) }, project.id));
  }
  return <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-indigo-600">Edit project</summary>
    <form onSubmit={submit} className="mt-3 grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <input className={field} name="name" defaultValue={project.name} required minLength={2} />
      <select className={field} name="clientId" defaultValue={project.clientId}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <textarea className={field} name="description" defaultValue={project.description ?? ""} />
      <label className="text-xs text-slate-500">Start date<input className={field} type="date" name="startDate" defaultValue={project.startDate?.toISOString().slice(0,10) ?? ""} /></label>
      <label className="text-xs text-slate-500">Due date<input className={field} type="date" name="dueDate" defaultValue={project.dueDate?.toISOString().slice(0,10) ?? ""} /></label>
      <input className={field} type="number" min="0" step="0.01" name="budget" defaultValue={project.budget ?? ""} placeholder="Budget" />
      <fieldset className="grid gap-1"><legend className="text-xs text-slate-500">Project members</legend>{members.map(m => <label key={m.userId} className="flex items-center gap-2"><input type="checkbox" name="memberIds" value={m.userId} defaultChecked={project.memberIds.includes(m.userId)} />{m.name ?? m.email}</label>)}</fieldset>
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-white disabled:opacity-50">Save project</button>
    </form>
    <button disabled={pending} onClick={() => { if (confirm("Delete this project and its tasks, milestones, and deliverables?")) execute(() => deleteProjectAction(workspaceId, project.id)); }} className="mt-2 text-red-600">Delete project</button>
    {message ? <p role="status" className="mt-2 text-xs text-slate-500">{message}</p> : null}
  </details>;
}

export function MilestoneRecordControls({ workspaceId, milestone }: { workspaceId: string; milestone: { id: string; projectId: string; name: string; description: string | null; dueDate: Date | null; status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; position: number } }) {
  const { pending, message, execute } = useRecordAction();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    execute(() => saveMilestoneAction(workspaceId, { projectId: milestone.projectId, name: fd.get("name"), description: fd.get("description") || undefined, dueDate: fd.get("dueDate") || undefined, status: fd.get("status"), position: Number(fd.get("position")) }, milestone.id));
  }
  return <details className="mt-2 text-xs"><summary className="cursor-pointer text-indigo-600">Edit</summary><form onSubmit={submit} className="mt-2 grid gap-2">
    <input className={field} name="name" defaultValue={milestone.name} required minLength={2} />
    <textarea className={field} name="description" defaultValue={milestone.description ?? ""} />
    <input className={field} type="date" name="dueDate" defaultValue={milestone.dueDate?.toISOString().slice(0,10) ?? ""} />
    <select className={field} name="status" defaultValue={milestone.status}><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select>
    <input className={field} type="number" min="0" name="position" defaultValue={milestone.position} />
    <button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-white">Save milestone</button>
  </form><button disabled={pending} onClick={() => { if (confirm("Delete this milestone? It must not have tasks.")) execute(() => deleteMilestoneAction(workspaceId, milestone.id)); }} className="mt-2 text-red-600">Delete</button>{message ? <p role="status" className="mt-2 text-slate-500">{message}</p> : null}</details>;
}

export function TaskRecordControls({ workspaceId, task, projectId, members }: { workspaceId: string; projectId: string; task: { id: string; title: string; description: string | null; status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; visibleToClient: boolean; dueDate: Date | null; assigneeId: string | null }; members: Member[] }) {
  const { pending, message, execute } = useRecordAction();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    execute(() => saveTaskAction(workspaceId, { projectId, title: fd.get("title"), description: fd.get("description") || undefined, status: fd.get("status"), priority: fd.get("priority"), visibleToClient: fd.get("visibleToClient") === "on", dueDate: fd.get("dueDate") || undefined, assigneeId: fd.get("assigneeId") || undefined }, task.id));
  }
  return <details className="mt-2 text-xs"><summary className="cursor-pointer text-indigo-600">Edit</summary><form onSubmit={submit} className="mt-2 grid gap-2">
    <input className={field} name="title" defaultValue={task.title} required minLength={2} />
    <textarea className={field} name="description" defaultValue={task.description ?? ""} />
    <select className={field} name="assigneeId" defaultValue={task.assigneeId ?? ""}><option value="">Unassigned</option>{members.map(m => <option key={m.userId} value={m.userId}>{m.name ?? m.email}</option>)}</select>
    <select className={field} name="priority" defaultValue={task.priority}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select>
    <select className={field} name="status" defaultValue={task.status}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="IN_REVIEW">In review</option><option value="DONE">Done</option></select>
    <input className={field} type="date" name="dueDate" defaultValue={task.dueDate?.toISOString().slice(0,10) ?? ""} />
    <label className="flex items-center gap-2"><input type="checkbox" name="visibleToClient" defaultChecked={task.visibleToClient} /> Visible to client</label>
    <button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-white">Save task</button>
  </form><button disabled={pending} onClick={() => { if (confirm("Delete this task?")) execute(() => deleteTaskAction(workspaceId, task.id)); }} className="mt-2 text-red-600">Delete</button>{message ? <p role="status" className="mt-2 text-slate-500">{message}</p> : null}</details>;
}
