import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for the target database.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const duplicates = await prisma.$queryRaw<Array<{ userId: string; profileCount: bigint }>>`
      SELECT "userId", COUNT(*)::bigint AS "profileCount"
      FROM "Client"
      WHERE "userId" IS NOT NULL
      GROUP BY "userId"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, "userId"
    `;
    if (duplicates.length) {
      console.error("Preflight FAILED: duplicate Client.userId links must be resolved before migration.");
      for (const row of duplicates) console.error(`userId=${row.userId} clientProfiles=${row.profileCount.toString()}`);
      process.exitCode = 1;
    } else {
      console.log("Preflight PASSED: no duplicate non-null Client.userId values found.");
      console.log("You may now run: npm run db:deploy");
    }
  } catch (error) {
    console.error("Preflight FAILED: could not verify the target database. Do not run migrations.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("Preflight FAILED: could not initialize the target database check.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
