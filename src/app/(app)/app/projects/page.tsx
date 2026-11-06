import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/server/authz";
import { CreateProjectForm } from "@/app/components/project-forms";
import { ProjectRecordControls } from "@/app/components/record-controls";

type SearchParams = Promise<{ cursor?: string }>;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/app");
  await requireWorkspaceMember(workspaceId);

  const params = await searchParams;
  const prisma = getPrisma();
  const [projectRows, clients, members] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      take: 51,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        clientId: true,
        startDate: true,
        dueDate: true,
        budget: true,
        client: { select: { name: true } },
        members: { select: { userId: true } },
        _count: { select: { tasks: true, deliverables: true } },
      },
    }),
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      take: 100,
      select: { id: true, name: true },
    }),
    prisma.workspaceMember
      .findMany({
        where: { workspaceId },
        orderBy: { userId: "asc" },
        take: 100,
        select: {
          userId: true,
          user: { select: { name: true, email: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          userId: row.userId,
          name: row.user.name,
          email: row.user.email,
        })),
      ),
  ]);

  const hasMore = projectRows.length > 50;
  const projects = hasMore ? projectRows.slice(0, 50) : projectRows;
  const nextCursor = hasMore ? projects[projects.length - 1]?.id : undefined;
  const nextHref = nextCursor
    ? `/app/projects?cursor=${encodeURIComponent(nextCursor)}`
    : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/app" className="text-sm font-medium text-indigo-600">
        ← Dashboard
      </Link>
      <h1 className="mt-5 text-3xl font-semibold">Projects</h1>
      <p className="mt-2 text-slate-500">Projects belonging to this workspace.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        <CreateProjectForm
          workspaceId={workspaceId}
          clients={clients}
          members={members}
        />
        <div>
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950"
              >
                <Link href={`/app/projects/${project.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-semibold">{project.name}</h2>
                    <span className="text-xs text-slate-500">
                      {project.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{project.client.name}</p>
                  <div className="mt-6 flex gap-5 text-xs text-slate-500">
                    <span>{project._count.tasks} tasks</span>
                    <span>{project._count.deliverables} deliverables</span>
                    <span>
                      {project.dueDate
                        ? `Due ${project.dueDate.toLocaleDateString()}`
                        : "No due date"}
                    </span>
                  </div>
                </Link>
                <ProjectRecordControls
                  workspaceId={workspaceId}
                  project={{
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    clientId: project.clientId,
                    startDate: project.startDate,
                    dueDate: project.dueDate,
                    budget: project.budget?.toString() ?? null,
                    memberIds: project.members.map((member) => member.userId),
                  }}
                  clients={clients}
                  members={members}
                />
              </article>
            ))}
            {!projects.length ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-500 dark:border-slate-700">
                {params.cursor ? "No more projects." : "No projects yet."}
              </p>
            ) : null}
          </div>
          {nextHref ? (
            <div className="mt-6 text-center">
              <Link
                href={nextHref}
                className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
              >
                Load more projects
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
