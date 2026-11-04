import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/server/authz";
import { CreateClientForm } from "@/app/components/project-forms";
import { ClientPortalInvitationForm } from "@/app/components/client-portal-invitation-form";
import { ClientRecordControls } from "@/app/components/phase3-record-controls";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/app");
  await requireWorkspaceMember(workspaceId);
  const clients = await getPrisma().client.findMany({
    where: { workspaceId }, orderBy: { name: "asc" }, take: 100,
    select: { id: true, name: true, email: true, company: true, phone: true, userId: true, _count: { select: { projects: true } } },
  });
  return <main className="mx-auto max-w-6xl px-6 py-10"><Link href="/app" className="text-sm font-medium text-indigo-600">← Dashboard</Link><h1 className="mt-5 text-3xl font-semibold">Clients</h1><p className="mt-2 text-slate-500">Clients in this workspace.</p><div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]"><CreateClientForm workspaceId={workspaceId} /><div className="grid gap-3 sm:grid-cols-2">{clients.map(client => <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><h2 className="font-semibold">{client.name}</h2><p className="mt-1 text-sm text-slate-500">{client.company ?? client.email}</p><p className="mt-4 text-xs text-slate-500">{client._count.projects} projects · {client.userId ? "Portal linked" : "No portal account"}</p>{!client.userId && (session.user.role === "OWNER" || session.user.role === "ADMIN") ? <ClientPortalInvitationForm workspaceId={workspaceId} clientId={client.id} clientName={client.name} /> : client.userId ? <p className="mt-3 text-xs text-emerald-600">Client portal linked</p> : null}<ClientRecordControls workspaceId={workspaceId} client={client} /></article>)}{!clients.length ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">No clients added yet.</p> : null}</div></div></main>;
}