import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
function createPrismaClient() { const adapter = new PrismaPg({ connectionString: serverEnv.DATABASE_URL }); return new PrismaClient({ adapter }); }
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (serverEnv.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
