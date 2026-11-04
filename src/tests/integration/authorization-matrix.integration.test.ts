import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: authMock }));

import { getPrisma } from "@/lib/prisma";
import {
  createClientAction, createMilestoneAction, createProjectAction, createTaskAction, updateTaskStatusAction,
} from "@/app/actions/project-actions";
import {
  saveClientAction, deleteClientAction, saveProjectAction, deleteProjectAction,
  saveMilestoneAction, deleteMilestoneAction, saveTaskAction, deleteTaskAction,
  changeMemberRoleAction, removeWorkspaceMemberAction,
} from "@/app/actions/phase3-actions";
import {
  createDeliverableAction, createNextDeliverableVersionAction, submitDeliverableAction,
  submitClientReviewAction, addClientDeliverableCommentAction, addTeamDeliverableCommentAction,
} from "@/app/actions/deliverable-actions";
import { createInvitationAction } from "@/app/actions/invitation-actions";
import { createClientPortalInvitationAction } from "@/app/actions/client-invitation-actions";

const prisma = getPrisma();
const suffix = crypto.randomUUID();
const roles = ["OWNER", "ADMIN", "MEMBER", "CLIENT"] as const;
const teamRoles = ["OWNER", "ADMIN", "MEMBER"] as const;
type Role = (typeof roles)[number];
const userIds = new Map<Role, string>();
let workspaceId = "";
let clientId = "";
let projectId = "";
let deliverableId = "";

const resultActions: Array<{
  name: string;
  allowed: readonly Role[];
  run: (id: string) => Promise<{ ok: boolean; error?: { code: string } }>;
}> = [
  { name: "create client", allowed: teamRoles, run: (id) => createClientAction(id, {}) },
  { name: "create project", allowed: teamRoles, run: (id) => createProjectAction(id, {}) },
  { name: "create task", allowed: teamRoles, run: (id) => createTaskAction(id, {}) },
  { name: "create milestone", allowed: teamRoles, run: (id) => createMilestoneAction(id, {}) },
  { name: "update task status", allowed: teamRoles, run: (id) => updateTaskStatusAction(id, {}) },
  { name: "save client", allowed: teamRoles, run: (id) => saveClientAction(id, {}) },
  { name: "delete client", allowed: ["OWNER", "ADMIN"], run: (id) => deleteClientAction(id, "missing-client") },
  { name: "save project", allowed: teamRoles, run: (id) => saveProjectAction(id, {}) },
  { name: "delete project", allowed: ["OWNER", "ADMIN"], run: (id) => deleteProjectAction(id, "missing-project") },
  { name: "save milestone", allowed: teamRoles, run: (id) => saveMilestoneAction(id, {}) },
  { name: "delete milestone", allowed: ["OWNER", "ADMIN"], run: (id) => deleteMilestoneAction(id, "missing-milestone") },
  { name: "save task", allowed: teamRoles, run: (id) => saveTaskAction(id, {}) },
  { name: "delete task", allowed: ["OWNER", "ADMIN"], run: (id) => deleteTaskAction(id, "missing-task") },
  { name: "change member role", allowed: ["OWNER"], run: (id) => changeMemberRoleAction(id, {}) },
  { name: "remove workspace member", allowed: ["OWNER"], run: (id) => removeWorkspaceMemberAction(id, {}) },
  { name: "create deliverable", allowed: teamRoles, run: (id) => createDeliverableAction(id, {}) },
  { name: "create next deliverable version", allowed: teamRoles, run: (id) => createNextDeliverableVersionAction(id, "missing-deliverable") },
  { name: "submit deliverable", allowed: teamRoles, run: (id) => submitDeliverableAction(id, "missing-deliverable", 0) },
  { name: "create workspace invitation", allowed: ["OWNER", "ADMIN"], run: (id) => createInvitationAction(id, {}) },
  { name: "create client portal invitation", allowed: ["OWNER", "ADMIN"], run: (id) => createClientPortalInvitationAction(id, {}) },
];

async function expectThrownAuthorization(run: () => Promise<unknown>, allowed: boolean) {
  let thrown: unknown;
  try {
    await run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).name === "AuthzError").toBe(!allowed);
}

beforeAll(async () => {
  await Promise.all(roles.map(async (role) => {
    const user = await prisma.user.create({
      data: { name: role, email: `${role.toLowerCase()}-${suffix}@authorization.test`, passwordHash: "integration-test-only" },
      select: { id: true },
    });
    userIds.set(role, user.id);
  }));
  const workspace = await prisma.workspace.create({
    data: {
      name: "Action Matrix Workspace",
      slug: `action-matrix-${suffix}`,
      ownerId: userIds.get("OWNER")!,
      members: { create: teamRoles.map((role) => ({ userId: userIds.get(role)!, role })) },
    },
    select: { id: true },
  });
  workspaceId = workspace.id;
  const client = await prisma.client.create({
    data: {
      workspaceId,
      userId: userIds.get("CLIENT")!,
      name: "Authorization Matrix Client",
      email: `client-${suffix}@example.test`,
    },
    select: { id: true },
  });
  clientId = client.id;
  const project = await prisma.project.create({
    data: { workspaceId, clientId, name: "Authorization Matrix Project" },
    select: { id: true },
  });
  projectId = project.id;
  const deliverable = await prisma.deliverable.create({
    data: { workspaceId, projectId, name: "Authorization Matrix Deliverable" },
    select: { id: true },
  });
  deliverableId = deliverable.id;
});

afterAll(async () => {
  if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { id: { in: [...userIds.values()] } } });
  await prisma.$disconnect();
});

describe("PostgreSQL server-action authorization matrix", () => {
  it.each(resultActions.flatMap((action) =>
    roles.map((role) => ({ action: action.name, run: action.run, allowed: action.allowed.includes(role), role })),
  ))("$role -> $action: allowed=$allowed", async ({ run, allowed, role }) => {
    authMock.mockResolvedValue({
      user: { id: userIds.get(role), role, clientId: role === "CLIENT" ? clientId : null },
    });
    const result = await run(workspaceId);
    // Allowed roles reach service validation/resource checks; denied roles stop at authz.
    expect(result.ok).toBe(false);
    expect(result.error?.code === "AuthzError").toBe(!allowed);
  });

  it.each(roles)("%s -> client review/comment actions", async (role) => {
    const allowed = role === "CLIENT";
    authMock.mockResolvedValue({
      user: { id: userIds.get(role), role, clientId: allowed ? clientId : null },
    });
    const review = new FormData();
    review.set("workspaceId", workspaceId);
    review.set("deliverableId", deliverableId);
    review.set("expectedRevision", "0");
    review.set("decision", "APPROVED");
    review.set("feedback", "");
    let reviewError: unknown;
    try {
      await submitClientReviewAction(review);
    } catch (error) {
      reviewError = error;
    }
    expect(reviewError).toBeInstanceOf(Error);
    expect((reviewError as Error).message === "Client portal access is required.").toBe(!allowed);

    const comment = new FormData();
    comment.set("workspaceId", workspaceId);
    comment.set("deliverableId", deliverableId);
    comment.set("body", "Authorization matrix comment");
    await expectThrownAuthorization(() => addClientDeliverableCommentAction(comment), allowed);
  });

  it.each(roles)("%s -> team deliverable comments", async (role) => {
    const allowed = teamRoles.includes(role as (typeof teamRoles)[number]);
    authMock.mockResolvedValue({ user: { id: userIds.get(role), role } });
    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("deliverableId", deliverableId);
    form.set("body", "Authorization matrix comment");
    await expectThrownAuthorization(() => addTeamDeliverableCommentAction(form), allowed);
  });
});
