# ClientFlow

ClientFlow is a multi-tenant client and project management SaaS for freelancers and small agencies. Teams manage clients, projects, milestones, tasks, and versioned deliverables. Clients receive a restricted portal to track shared progress and approve or request changes to submitted work.

## Stack

- Next.js App Router, React Server Components, Server Actions, Route Handlers
- TypeScript strict mode
- PostgreSQL and Prisma 7
- Auth.js Credentials with JWT sessions
- Argon2id password hashing
- Tailwind CSS
- Zod validation
- Vitest and Playwright
- Vercel deployment target with Neon PostgreSQL
- Local private file storage in development; S3-compatible private object storage in production

## Local setup

Requirements: Node.js 22+, npm, and Docker Desktop / Docker Engine.

1. Start the local PostgreSQL database:

   ```bash
   docker compose up -d postgres
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env`:

   **PowerShell**
   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS / Linux**
   ```bash
   cp .env.example .env
   ```

4. Configure `DATABASE_URL` and a random `AUTH_SECRET` (at least 32 characters).
5. Generate the Prisma Client:

   ```bash
   npm run db:generate
   ```

6. Apply the Prisma migration(s):

   ```bash
   npm run db:migrate
   ```

7. Seed the local database with demo workspaces, roles, clients, and projects:

   ```bash
   npm run db:seed
   ```

8. Start the app:

   ```bash
   npm run dev
   ```

Open http://localhost:3000, create an account, and create a workspace.

## Main flows currently implemented

- Account registration and Credentials sign-in with Argon2id verification.
- Workspace creation and OWNER membership.
- Workspace-scoped client and project creation.
- Project milestones and task creation/status changes.
- Client portal account linking to an existing account with a matching email.
- Restricted client portal project overview; only tasks marked `visibleToClient` are returned.
- Deliverable drafts, submission, client approval or change requests, and version creation after requested changes.
- Optimistic revision checks to prevent duplicate deliverable decisions.
- Transactional Activity records for supported mutations.
- Workspace invitations with hashed, expiring tokens and acceptance.
- Database-backed login and invitation rate limits.
- Private file upload/download through local storage in development and S3-compatible storage in production.

## Production object storage

Configure these environment variables in Vercel (or the deployment environment):

- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- Optional `S3_ENDPOINT` for S3-compatible services such as Cloudflare R2.

The production storage adapter uses server-side credentials and does not expose object URLs publicly. Downloads are streamed through an authenticated Route Handler.

Uploads currently allow PDF, PNG, JPEG, WebP, DOCX, and XLSX files up to 4 MB. File names are sanitized for display; object keys are generated server-side.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

GitHub Actions runs Prisma Client generation, lint, type checking, unit tests, production build, and Playwright E2E checks.

## Database commands

- `npm run db:generate` — generate Prisma Client.
- `npm run db:seed` — seed local demo users, workspaces, clients, and projects.
- `docker compose down -v` — remove the local database volume (destructive; deletes local data).
- `npm run db:migrate` — create/apply a development migration.
- `npm run db:deploy` — apply committed migrations in deployment.
- `npm run db:studio` — open Prisma Studio.

Commit migration files together with schema changes. Never commit `.env`, database credentials, or production secrets.

## Security and architecture rules

- Workspace-owned reads and writes are scoped by `workspaceId`.
- Workspace membership, role checks, and client project access are enforced server-side.
- Client portal queries exclude internal tasks and unrelated client projects.
- Server inputs are validated with Zod and persisted under database constraints.
- Deliverable state transitions are explicit; decided versions are not edited in place.
- Revision checks use conditional updates inside transactions.
- Supported mutations create Activity records in the same transaction.
- Services live in `src/server/services`; shared schemas live in `src/lib/validations`.
- Private file downloads re-check workspace or client project access on every request.

## Deployment

1. Provision Neon PostgreSQL and set `DATABASE_URL`.
2. Set `AUTH_SECRET`, `AUTH_URL`, and the S3-compatible storage variables.
3. Configure the Vercel project for this repository and branch.
4. Run `npm run db:deploy` as a release/deployment step before serving the new application version.
5. Deploy with `npm run build`.

Do not consider a deployment production-ready until a real Neon database, production S3 bucket, environment variables, and the complete migration set have been configured and verified.


See [docs/DATABASE.md](docs/DATABASE.md) for the Mermaid ER diagram and database constraint rationale.
