import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getServerEnv();
  const adapter = new PrismaPg({ connectionString: DATABASE_URL });

  return new PrismaClient({ adapter });
}

/**
 * Reuse one Prisma client and its underlying connection pool per Node.js
 * runtime. Serverless instances can be reused across requests in production;
 * creating a client on every getPrisma() call needlessly churns pools and
 * increases connection pressure.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}
