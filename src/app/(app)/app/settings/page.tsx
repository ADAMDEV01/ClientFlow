import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { WorkspaceSwitcher } from "@/app/components/workspace-switcher";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const memberships = await getPrisma().workspaceMember.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { role: true, workspace: { select: { id: true, name: true, slug: true } } },
  });
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <p className="mt-2 text-slate-500">Manage your active workspace and account context.</p>
      <section className="mt-8 max-w-xl rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="font-semibold">Active workspace</h2>
        <p className="mt-1 text-sm text-slate-500">Switching workspaces changes the tenant context for the team area.</p>
        <WorkspaceSwitcher memberships={memberships} activeWorkspaceId={session.user.workspaceId} />
        {memberships.length === 100 ? <p className="mt-3 text-xs text-slate-500">Showing up to 100 workspace memberships.</p> : null}
      </section>
    </main>
  );
}
