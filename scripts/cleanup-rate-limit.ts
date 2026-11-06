import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required for RateLimit cleanup.");
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const cutoff = new Date();
    let totalDeleted = 0;

    while (true) {
      const deleted = await prisma.$executeRaw`
        DELETE FROM "RateLimitBucket"
        WHERE "key" IN (
          SELECT "key"
          FROM "RateLimitBucket"
          WHERE "resetAt" <= ${cutoff}
          ORDER BY "resetAt"
          LIMIT 10000
          FOR UPDATE SKIP LOCKED
        )
      `;
      totalDeleted += Number(deleted);
      if (Number(deleted) < 10000) break;
    }

    console.log(`RateLimit cleanup completed. Deleted ${totalDeleted} expired buckets.`);
  } catch (error) {
    console.error("RateLimit cleanup failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
