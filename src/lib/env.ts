import { z } from "zod";
const serverEnvSchema = z.object({ DATABASE_URL: z.string().min(1), AUTH_SECRET: z.string().min(32), AUTH_URL: z.url().optional(), NODE_ENV: z.enum(["development","test","production"]).default("development") });
export const serverEnv = serverEnvSchema.parse({ DATABASE_URL: process.env.DATABASE_URL, AUTH_SECRET: process.env.AUTH_SECRET, AUTH_URL: process.env.AUTH_URL, NODE_ENV: process.env.NODE_ENV });
