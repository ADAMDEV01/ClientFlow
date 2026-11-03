# ClientFlow

A multi-tenant client and project management SaaS for freelancers and small agencies.

## Stack
- Next.js App Router, React Server Components, TypeScript strict mode
- PostgreSQL with Prisma ORM
- Auth.js foundation, Credentials and server-side sessions
- Tailwind CSS, Zod, Vitest, Playwright
- Vercel and Neon deployment targets

## Requirements
- Node.js 22.12+ (or a supported newer LTS)
- npm and a PostgreSQL database (Neon recommended for hosted environments)

## Getting started
1. Install: `npm install`
2. Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`).
3. Set `DATABASE_URL` and generate a strong `AUTH_SECRET`.
4. Generate Prisma client: `npm run db:generate`
5. Start: `npm run dev`
6. Visit http://localhost:3000.

## Quality checks
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:e2e`
- `npm run build`

## Database workflow
- Development migration: `npm run db:migrate`
- Apply committed migrations: `npm run db:deploy`
- Database browser: `npm run db:studio`

Never commit `.env` or production credentials. Commit migration files with schema changes.

## Architecture rules
- Feature code belongs in `src/features`; shared UI in `src/components`.
- Server-only data access and business services belong in `src/server`.
- Shared infrastructure and validation belong in `src/lib`.
- Every workspace-owned database operation must be scoped by `workspaceId`.
- Authorization is enforced server-side, never only through conditional rendering.
- Mutations validate input and write activity records in the same database transaction.

## Status
Phase 1 establishes the application scaffold and developer tooling. Authentication flows, domain models, authorization policies, and production data operations are introduced in their dedicated phases.
