import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for RateLimit cleanup.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const cutoff = new Date();
    let totalDeleted = 0;

    while (true) {
      const deleted = await prisma.$executeRaw`
        WITH expired AS (
          SELECT "key"
          FROM "RateLimitBucket"
          WHERE "resetAt" <= ${cutoff}
          ORDER BY "resetAt"
          LIMIT 10000
          FOR UPDATE SKIP LOCKED
        )
        DELETE FROM "RateLimitBucket" AS bucket
        USING expired
        WHERE bucket."key" = expired."key"
      `;
      totalDeleted += Number(deleted);
      if (Number(deleted) < 10000) break;
    }

    console.log(`RateLimit cleanup completed. Deleted ${totalDeleted} expired buckets.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("RateLimit cleanup failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
