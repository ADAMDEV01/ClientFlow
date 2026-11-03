import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { acceptInvitationAction } from "@/app/actions/invitation-actions";

export default async function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { token } = await params;
  return <main className="flex min-h-screen items-center justify-center px-6"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-950"><Link href="/" className="text-sm font-bold text-indigo-600">CLIENTFLOW</Link><h1 className="mt-6 text-2xl font-semibold">Join a workspace</h1><p className="mt-2 text-sm text-slate-500">Accept this invitation using your signed-in account.</p><form action={acceptInvitationAction} className="mt-6"><input type="hidden" name="token" value={token} /><button className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white">Accept invitation</button></form></section></main>;
}
