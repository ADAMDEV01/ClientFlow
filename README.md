# ClientFlow

ClientFlow is a multi-tenant client and project management SaaS for freelancers and small agencies. Teams manage projects, milestones, tasks, and versioned deliverables; clients receive a restricted portal for progress and review.

## Technology

- Next.js App Router and React Server Components
- TypeScript in strict mode
- PostgreSQL and Prisma ORM
- Auth.js (Credentials authentication and JWT sessions)
- Tailwind CSS
- Zod validation
- Vitest and Playwright
- Deployment target: Vercel with Neon PostgreSQL

## Requirements

- Node.js 22+
- npm
- PostgreSQL 15+ (Neon is recommended for hosted environments)

## Local setup

1. Clone the repository and check out the working branch.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file:

   **PowerShell**
   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS / Linux**
   ```bash
   cp .env.example .env
   ```

4. Set `DATABASE_URL` to your PostgreSQL connection string and replace `AUTH_SECRET` with a random secret of at least 32 characters.
5. Generate the Prisma Client:

   ```bash
   npm run db:generate
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open http://localhost:3000.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

A GitHub Actions workflow runs linting, type checking, unit tests, the production build, and Playwright E2E tests on pushes and pull requests.

## Database commands

- `npm run db:generate` — generate the Prisma Client.
- `npm run db:migrate` — create and apply a development migration.
- `npm run db:deploy` — apply committed migrations in deployment environments.
- `npm run db:studio` — open Prisma Studio.

Commit migration files together with schema changes. Never commit `.env`, database credentials, or production secrets.

## Architecture conventions

- Feature-specific code lives in `src/features`.
- Shared UI lives in `src/components`.
- Shared infrastructure and validation live in `src/lib`.
- Server-side services and authorization live in `src/server`.
- Tests live in `src/tests`; browser E2E tests live in `e2e`.
- Every workspace-owned read and write must be scoped by `workspaceId`.
- Authorization must be enforced on the server.
- Mutations validate input and write their activity records in the same database transaction.

## Current implementation status

The repository currently contains the Next.js application scaffold, Prisma/PostgreSQL configuration, Auth.js route scaffolding, typed action-result helpers, and initial unit/E2E tests. The domain schema, working Credentials sign-in flow, authorization policies, and product features are not yet implemented. Do not treat the scaffold as a production-ready application.
