import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth-actions";
import { getClientPortalInvitation } from "@/server/services/client-invitation-service";
import { ClientInvitationAcceptForm } from "@/app/components/client-portal-invitation-form";

export default async function AcceptClientInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getClientPortalInvitation(token);
  if (!invitation || invitation.client.userId) notFound();
  const session = await auth();
  const authenticated = Boolean(session?.user?.id && session.user.email?.toLowerCase() === invitation.email.toLowerCase());
  if (session?.user?.id && !authenticated) {
    return <main className="flex min-h-screen items-center justify-center px-6"><section className="w-full max-w-md rounded-3xl border border-slate-200 p-8 dark:border-slate-800"><h1 className="text-2xl font-semibold">Use the invited email</h1><p className="mt-3 text-sm text-slate-500">This invitation was sent to {invitation.email}. Sign out, then sign in with that email address.</p><form action={logoutAction} className="mt-5"><button className="font-semibold text-indigo-600">Sign out</button></form></section></main>;
  }
  return <main className="flex min-h-screen items-center justify-center px-6 py-12"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-950"><Link href="/" className="text-sm font-bold text-indigo-600">CLIENTFLOW</Link><h1 className="mt-6 text-2xl font-semibold">Join {invitation.workspace.name}&apos;s client portal</h1><p className="mt-2 text-sm text-slate-500">{invitation.client.name} · {invitation.email}</p><p className="mt-2 text-xs text-slate-500">This secure invitation expires {invitation.expiresAt.toLocaleDateString()} and can only be used once.</p><ClientInvitationAcceptForm token={token} email={invitation.email} authenticated={authenticated} />{!authenticated ? <p className="mt-5 text-center text-sm text-slate-500">Already have an account? <Link href={`/login?next=${encodeURIComponent(`/client-invite/${token}`)}`} className="font-semibold text-indigo-600">Sign in first</Link></p> : null}</section></main>;
}
