import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));

import { getPrisma } from "@/lib/prisma";
import { createClientAction } from "@/app/actions/project-actions";
import {
  saveClientAction, deleteClientAction, saveProjectAction, deleteProjectAction,
  saveMilestoneAction, deleteMilestoneAction, saveTaskAction, deleteTaskAction,
} from "@/app/actions/phase3-actions";
import {
  createDeliverableAction, submitDeliverableAction, createNextDeliverableVersionAction,
  submitClientReviewAction, addClientDeliverableCommentAction, addTeamDeliverableCommentAction,
} from "@/app/actions/deliverable-actions";
import { createInvitationAction } from "@/app/actions/invitation-actions";

const prisma = getPrisma();
const suffix = crypto.randomUUID();
let ownerId = "";
let clientUserId = "";
let workspaceId = "";
let clientId = "";

beforeAll(async () => {
  const owner = await prisma.user.create({
    data: { name: "Operations Owner", email: `operations-owner-${suffix}@test.example`, passwordHash: "integration-test-only" },
    select: { id: true },
  });
  ownerId = owner.id;
  const clientUser = await prisma.user.create({
    data: { name: "Operations Client", email: `operations-client-${suffix}@test.example`, passwordHash: "integration-test-only" },
    select: { id: true },
  });
  clientUserId = clientUser.id;
  const workspace = await prisma.workspace.create({
    data: {
      name: "Authorized Operations Workspace",
      slug: `authorized-operations-${suffix}`,
      ownerId,
      members: { create: { userId: ownerId, role: "OWNER" } },
    },
    select: { id: true },
  });
  workspaceId = workspace.id;
  const client = await prisma.client.create({
    data: {
      workspaceId,
      userId: clientUserId,
      name: "Operations Client Profile",
      email: `operations-client-profile-${suffix}@test.example`,
    },
    select: { id: true },
  });
  clientId = client.id;
});

afterAll(async () => {
  // Reviews restrict deletion of their Client, so remove them before cascading the workspace.
  if (workspaceId && clientId) {
    await prisma.review.deleteMany({ where: { workspaceId, clientId } });
    await prisma.workspace.delete({ where: { id: workspaceId } });
  }
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, clientUserId].filter(Boolean) } } });
  await prisma.$disconnect();
});

describe("authorized server actions persist successful operations", () => {
  it("creates, updates, and deletes client, project, milestone, and task records", async () => {
    authMock.mockResolvedValue({ user: { id: ownerId, role: "OWNER" } });

    const createdClient = await createClientAction(workspaceId, {
      name: "Temporary Client",
      email: `temporary-client-${suffix}@test.example`,
      company: "Initial Company",
    });
    expect(createdClient.ok).toBe(true);
    if (!createdClient.ok) throw new Error(createdClient.error.message);

    const updatedClient = await saveClientAction(workspaceId, {
      name: "Updated Temporary Client",
      email: `temporary-client-${suffix}@test.example`,
      company: "Updated Company",
    }, createdClient.data.id);
    expect(updatedClient.ok).toBe(true);
    expect(await prisma.client.findUnique({ where: { id: createdClient.data.id } }))
      .toMatchObject({ name: "Updated Temporary Client", company: "Updated Company" });

    const createdProject = await saveProjectAction(workspaceId, {
      name: "Operations Project",
      description: "Initial project description",
      clientId,
      memberIds: [ownerId],
    });
    expect(createdProject.ok).toBe(true);
    if (!createdProject.ok) throw new Error(createdProject.error.message);

    const updatedProject = await saveProjectAction(workspaceId, {
      name: "Updated Operations Project",
      description: "Persisted project update",
      clientId,
      memberIds: [ownerId],
    }, (createdProject.data as { id: string }).id);
    expect(updatedProject.ok).toBe(true);
    expect(await prisma.project.findUnique({ where: { id: (createdProject.data as { id: string }).id } }))
      .toMatchObject({ name: "Updated Operations Project", description: "Persisted project update" });

    const milestone = await saveMilestoneAction(workspaceId, {
      projectId: (createdProject.data as { id: string }).id,
      name: "Initial milestone",
      status: "PENDING",
    });
    expect(milestone.ok).toBe(true);
    if (!milestone.ok) throw new Error(milestone.error.message);

    const updatedMilestone = await saveMilestoneAction(workspaceId, {
      projectId: (createdProject.data as { id: string }).id,
      name: "Updated milestone",
      status: "COMPLETED",
    }, (milestone.data as { id: string }).id);
    expect(updatedMilestone.ok).toBe(true);
    expect(await prisma.milestone.findUnique({ where: { id: (milestone.data as { id: string }).id } }))
      .toMatchObject({ name: "Updated milestone", status: "COMPLETED" });

    const task = await saveTaskAction(workspaceId, {
      projectId: (createdProject.data as { id: string }).id,
      milestoneId: (milestone.data as { id: string }).id,
      title: "Initial task",
      priority: "HIGH",
      status: "TODO",
      visibleToClient: true,
    });
    expect(task.ok).toBe(true);
    if (!task.ok) throw new Error(task.error.message);

    const updatedTask = await saveTaskAction(workspaceId, {
      projectId: (createdProject.data as { id: string }).id,
      milestoneId: (milestone.data as { id: string }).id,
      title: "Updated task",
      priority: "URGENT",
      status: "IN_PROGRESS",
      visibleToClient: true,
    }, (task.data as { id: string }).id);
    expect(updatedTask.ok).toBe(true);
    expect(await prisma.task.findUnique({ where: { id: (task.data as { id: string }).id } }))
      .toMatchObject({ title: "Updated task", priority: "URGENT", status: "IN_PROGRESS", visibleToClient: true });

    const deletedTask = await deleteTaskAction(workspaceId, (task.data as { id: string }).id);
    expect(deletedTask.ok).toBe(true);
    expect(await prisma.task.findUnique({ where: { id: (task.data as { id: string }).id } })).toBeNull();

    const deletedMilestone = await deleteMilestoneAction(workspaceId, (milestone.data as { id: string }).id);
    expect(deletedMilestone.ok).toBe(true);
    expect(await prisma.milestone.findUnique({ where: { id: (milestone.data as { id: string }).id } })).toBeNull();

    const deletedProject = await deleteProjectAction(workspaceId, (createdProject.data as { id: string }).id);
    expect(deletedProject.ok).toBe(true);
    expect(await prisma.project.findUnique({ where: { id: (createdProject.data as { id: string }).id } })).toBeNull();

    const deletedClient = await deleteClientAction(workspaceId, createdClient.data.id);
    expect(deletedClient.ok).toBe(true);
    expect(await prisma.client.findUnique({ where: { id: createdClient.data.id } })).toBeNull();
  });

  it("creates invitations and verifies the raw token is not persisted", async () => {
    authMock.mockResolvedValue({ user: { id: ownerId, role: "OWNER" } });
    const result = await createInvitationAction(workspaceId, {
      email: `invited-member-${suffix}@test.example`,
      role: "MEMBER",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);

    const saved = await prisma.invitation.findUniqueOrThrow({
      where: { id: result.data.id },
      select: { email: true, role: true, status: true, tokenHash: true, invitedById: true },
    });
    expect(saved).toMatchObject({
      email: `invited-member-${suffix}@test.example`,
      role: "MEMBER",
      status: "PENDING",
      invitedById: ownerId,
    });
    expect(saved.tokenHash).not.toBe(result.data.token);
    expect(saved.tokenHash).toHaveLength(64);
  });

  it("runs the complete deliverable review and revision lifecycle with persisted state", async () => {
    authMock.mockResolvedValue({ user: { id: ownerId, role: "OWNER" } });
    const project = await prisma.project.create({
      data: { workspaceId, clientId, name: "Deliverable Lifecycle Project" },
      select: { id: true },
    });

    const created = await createDeliverableAction(workspaceId, {
      projectId: project.id,
      name: "Homepage Design",
      description: "First draft",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.error.message);

    const submitted = await submitDeliverableAction(workspaceId, created.data.id, 0);
    expect(submitted.ok).toBe(true);
    expect(await prisma.deliverable.findUnique({ where: { id: created.data.id } }))
      .toMatchObject({ status: "SUBMITTED", revision: 1, version: 1 });

    const teamComment = new FormData();
    teamComment.set("workspaceId", workspaceId);
    teamComment.set("deliverableId", created.data.id);
    teamComment.set("body", "Team note before review");
    await addTeamDeliverableCommentAction(teamComment);

    authMock.mockResolvedValue({ user: { id: clientUserId, role: "CLIENT", clientId } });
    const clientComment = new FormData();
    clientComment.set("workspaceId", workspaceId);
    clientComment.set("deliverableId", created.data.id);
    clientComment.set("body", "Please clarify the first draft.");
    await addClientDeliverableCommentAction(clientComment);

    const review = new FormData();
    review.set("workspaceId", workspaceId);
    review.set("deliverableId", created.data.id);
    review.set("expectedRevision", "1");
    review.set("decision", "CHANGES_REQUESTED");
    review.set("feedback", "Please adjust the spacing.");
    await submitClientReviewAction(review);

    expect(await prisma.deliverable.findUnique({ where: { id: created.data.id } }))
      .toMatchObject({ status: "CHANGES_REQUESTED", revision: 2 });
    expect(await prisma.review.findMany({ where: { deliverableId: created.data.id } }))
      .toMatchObject([{ decision: "CHANGES_REQUESTED", feedback: "Please adjust the spacing.", reviewerId: clientUserId }]);
    expect(await prisma.deliverableComment.count({ where: { deliverableId: created.data.id } })).toBe(2);

    authMock.mockResolvedValue({ user: { id: ownerId, role: "OWNER" } });
    const nextVersion = await createNextDeliverableVersionAction(workspaceId, created.data.id);
    expect(nextVersion.ok).toBe(true);
    if (!nextVersion.ok) throw new Error(nextVersion.error.message);
    expect(nextVersion.data).toMatchObject({ version: 2, status: "DRAFT" });

    const resubmitted = await submitDeliverableAction(workspaceId, nextVersion.data.id, 0);
    expect(resubmitted.ok).toBe(true);
    expect(await prisma.deliverable.findUnique({ where: { id: nextVersion.data.id } }))
      .toMatchObject({ status: "SUBMITTED", revision: 1, version: 2 });

    authMock.mockResolvedValue({ user: { id: clientUserId, role: "CLIENT", clientId } });
    const approval = new FormData();
    approval.set("workspaceId", workspaceId);
    approval.set("deliverableId", nextVersion.data.id);
    approval.set("expectedRevision", "1");
    approval.set("decision", "APPROVED");
    approval.set("feedback", "");
    await submitClientReviewAction(approval);

    expect(await prisma.deliverable.findUnique({ where: { id: nextVersion.data.id } }))
      .toMatchObject({ status: "APPROVED", revision: 2, version: 2 });
    expect(await prisma.review.count({ where: { deliverableId: nextVersion.data.id, decision: "APPROVED" } })).toBe(1);
  });
});
