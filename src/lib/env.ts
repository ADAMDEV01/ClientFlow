import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters."),
  AUTH_URL: z.url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.url().optional(),
  S3_SERVER_SIDE_ENCRYPTION: z.enum(["AES256", "NONE"]).default("AES256"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parse server-only environment variables when they are needed.
 * Keeping this lazy allows Next.js tooling and static pages to load
 * without requiring database credentials during module evaluation.
 */
export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_SERVER_SIDE_ENCRYPTION: process.env.S3_SERVER_SIDE_ENCRYPTION,
  });
}
