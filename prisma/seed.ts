import "dotenv/config";

import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed ClientFlow.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "ClientFlowDemo!2026";
  const passwordHash = await argon2.hash(demoPassword, {
    type: argon2.argon2id,
  });

  const [owner, admin, member, clientPortalUser] = await Promise.all([
    prisma.user.upsert({
      where: { email: "owner@clientflow.local" },
      update: { name: "Alex Owner", passwordHash },
      create: { name: "Alex Owner", email: "owner@clientflow.local", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "admin@clientflow.local" },
      update: { name: "Sam Admin", passwordHash },
      create: { name: "Sam Admin", email: "admin@clientflow.local", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "member@clientflow.local" },
      update: { name: "Taylor Member", passwordHash },
      create: { name: "Taylor Member", email: "member@clientflow.local", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "client@clientflow.local" },
      update: { name: "Jordan Client", passwordHash },
      create: { name: "Jordan Client", email: "client@clientflow.local", passwordHash },
    }),
  ]);

  const [workspaceOne, workspaceTwo] = await Promise.all([
    prisma.workspace.upsert({
      where: { slug: "northstar-studio" },
      update: { name: "Northstar Studio", ownerId: owner.id },
      create: { name: "Northstar Studio", slug: "northstar-studio", ownerId: owner.id },
    }),
    prisma.workspace.upsert({
      where: { slug: "pixel-foundry" },
      update: { name: "Pixel Foundry", ownerId: owner.id },
      create: { name: "Pixel Foundry", slug: "pixel-foundry", ownerId: owner.id },
    }),
  ]);

  const memberships = [
    { workspaceId: workspaceOne.id, userId: owner.id, role: "OWNER" as const },
    { workspaceId: workspaceOne.id, userId: admin.id, role: "ADMIN" as const },
    { workspaceId: workspaceOne.id, userId: member.id, role: "MEMBER" as const },
    { workspaceId: workspaceTwo.id, userId: owner.id, role: "OWNER" as const },
  ];

  for (const membership of memberships) {
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: membership.workspaceId,
          userId: membership.userId,
        },
      },
      update: { role: membership.role },
      create: membership,
    });
  }

  const clientOne = await prisma.client.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspaceOne.id,
        email: "jordan@example.com",
      },
    },
    update: { name: "Jordan Lee", userId: clientPortalUser.id },
    create: {
      workspaceId: workspaceOne.id,
      name: "Jordan Lee",
      email: "jordan@example.com",
      company: "Brightside Co.",
      userId: clientPortalUser.id,
    },
  });

  const clientTwo = await prisma.client.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspaceTwo.id,
        email: "morgan@example.com",
      },
    },
    update: { name: "Morgan Reed" },
    create: {
      workspaceId: workspaceTwo.id,
      name: "Morgan Reed",
      email: "morgan@example.com",
      company: "Fieldwork Labs",
    },
  });

  const projectOne =
    (await prisma.project.findFirst({
      where: { workspaceId: workspaceOne.id, name: "Website Redesign" },
      select: { id: true },
    })) ??
    (await prisma.project.create({
      data: {
        workspaceId: workspaceOne.id,
        clientId: clientOne.id,
        name: "Website Redesign",
        description: "A responsive marketing site refresh.",
        status: "ACTIVE",
        members: { create: { userId: owner.id } },
      },
      select: { id: true },
    }));

  const projectTwo =
    (await prisma.project.findFirst({
      where: { workspaceId: workspaceTwo.id, name: "Product Launch Assets" },
      select: { id: true },
    })) ??
    (await prisma.project.create({
      data: {
        workspaceId: workspaceTwo.id,
        clientId: clientTwo.id,
        name: "Product Launch Assets",
        description: "Launch graphics and product collateral.",
        status: "PLANNING",
        members: { create: { userId: owner.id } },
      },
      select: { id: true },
    }));

  for (const [projectId, title, visibleToClient] of [
    [projectOne.id, "Approve homepage wireframes", true],
    [projectTwo.id, "Prepare launch moodboard", false],
  ] as const) {
    const exists = await prisma.task.findFirst({
      where: { workspaceId: projectId === projectOne.id ? workspaceOne.id : workspaceTwo.id, projectId, title },
      select: { id: true },
    });
    if (!exists) {
      await prisma.task.create({
        data: {
          workspaceId: projectId === projectOne.id ? workspaceOne.id : workspaceTwo.id,
          projectId,
          title,
          visibleToClient,
          status: "TODO",
        },
      });
    }
  }

  console.info("ClientFlow seed completed.");
  console.info("Demo users: owner@clientflow.local, admin@clientflow.local, member@clientflow.local, client@clientflow.local");
  console.info("Demo password: set SEED_DEMO_PASSWORD to override the local-only default.");
}

main()
  .catch((error: unknown) => {
    console.error("ClientFlow seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
