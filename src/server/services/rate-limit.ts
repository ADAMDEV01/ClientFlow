import "server-only";

import { getPrisma } from "@/lib/prisma";

/**
 * Database-backed fixed-window limiter. The conditional increment is atomic,
 * so parallel requests cannot exceed the configured limit.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const prisma = getPrisma();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  return prisma.$transaction(async (tx) => {
    await tx.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 0, resetAt },
      update: {},
    });

    await tx.rateLimitBucket.updateMany({
      where: { key, resetAt: { lte: now } },
      data: { count: 0, resetAt },
    });

    const updated = await tx.rateLimitBucket.updateMany({
      where: { key, count: { lt: limit }, resetAt: { gt: now } },
      data: { count: { increment: 1 } },
    });

    return updated.count === 1;
  });
}
