import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/server/authz";
import { InvitationForm } from "@/app/components/invitation-form";
import { TeamMemberControls } from "@/app/components/team-member-controls";

const PAGE_SIZE = 100;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/app");
  await requireWorkspaceMember(workspaceId);

  const params = await searchParams;
  const prisma = getPrisma();
  const [memberRows, invitations, ownerCount] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        userId: true,
        role: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.invitation.findMany({
      where: { workspaceId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
    prisma.workspaceMember.count({ where: { workspaceId, role: "OWNER" } }),
  ]);

  const hasMore = memberRows.length > PAGE_SIZE;
  const members = hasMore ? memberRows.slice(0, PAGE_SIZE) : memberRows;
  const nextCursor = hasMore ? members[members.length - 1]?.id : undefined;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/app" className="text-sm font-medium text-indigo-600">
        ← Dashboard
      </Link>
      <h1 className="mt-5 text-3xl font-semibold">Team</h1>
      <p className="mt-2 text-slate-500">
        Manage workspace access and invitations.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        {session.user.role === "OWNER" || session.user.role === "ADMIN" ? (
          <InvitationForm workspaceId={workspaceId} />
        ) : (
          <div className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">
            Only workspace owners and admins can invite teammates.
          </div>
        )}
        <section>
          <h2 className="font-semibold">Members</h2>
          <div className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {member.user.name ?? member.user.email}
                  </p>
                  <p className="text-xs text-slate-500">{member.user.email}</p>
                </div>
                <TeamMemberControls
                  workspaceId={workspaceId}
                  member={{
                    id: member.id,
                    userId: member.userId,
                    role: member.role,
                    name: member.user.name,
                    email: member.user.email,
                  }}
                  canManage={session.user.role === "OWNER"}
                  ownerCount={ownerCount}
                />
              </div>
            ))}
            {!members.length ? (
              <p className="p-4 text-sm text-slate-500">
                {params.cursor ? "No more members." : "No members found."}
              </p>
            ) : null}
          </div>
          {nextCursor ? (
            <div className="mt-5 text-center">
              <Link
                href={`/app/team?cursor=${encodeURIComponent(nextCursor)}`}
                className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
              >
                Load more members
              </Link>
            </div>
          ) : null}

          <h2 className="mt-8 font-semibold">Pending invitations</h2>
          <div className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {invitations.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-xs text-slate-500">
                    Expires {invite.expiresAt.toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {invite.role.toLowerCase()}
                </span>
              </div>
            ))}
            {!invitations.length ? (
              <p className="p-4 text-sm text-slate-500">
                No pending invitations.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
