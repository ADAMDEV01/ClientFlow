# Local PostgreSQL integration and E2E testing (Windows)

These instructions use disposable local databases only. The integration and E2E scripts now refuse to run unless `DATABASE_URL` points to a PostgreSQL database on `localhost`, `127.0.0.1`, or `::1` whose name contains `_test`, `_integration`, or `_e2e`. Do not point either suite at Neon, Vercel, Supabase, or any production/shared database.

## 1. Start local PostgreSQL

Install and open Docker Desktop, wait until its engine reports that it is running, then open PowerShell in the repository root:

```powershell
docker version
docker compose up -d postgres
docker compose ps
```

Wait until the PostgreSQL service is healthy:

```powershell
docker compose exec -T postgres pg_isready -U clientflow -d clientflow
```

## 2. Create a dedicated integration database

The Compose service creates the development database `clientflow`. Create a separate database for integration tests:

```powershell
$exists = docker compose exec -T postgres psql -U clientflow -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'clientflow_test'"
if ($exists.Trim() -ne "1") {
  docker compose exec -T postgres createdb -U clientflow clientflow_test
}
```

Set test-only environment values in the current PowerShell session. These values override any `DATABASE_URL` loaded from `.env`:

```powershell
$env:DATABASE_URL = "postgresql://clientflow:clientflow_dev_password@127.0.0.1:5432/clientflow_test?schema=public"
$env:AUTH_SECRET = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:NODE_ENV = "test"
```

Install dependencies and apply the committed migrations to the empty test database:

```powershell
npm ci
npm run db:generate
npm run db:deploy
```

Run the PostgreSQL integration suite:

```powershell
npm run test:integration
```

## 3. Run E2E against a separate database

Do not reuse the integration database. Create a second empty database:

```powershell
$exists = docker compose exec -T postgres psql -U clientflow -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'clientflow_e2e'"
if ($exists.Trim() -ne "1") {
  docker compose exec -T postgres createdb -U clientflow clientflow_e2e
}
$env:DATABASE_URL = "postgresql://clientflow:clientflow_dev_password@127.0.0.1:5432/clientflow_e2e?schema=public"
$env:AUTH_SECRET = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:NODE_ENV = "test"
$env:SEED_DEMO_PASSWORD = "Local-E2E-Only-Change-This-2026!"
npm run db:deploy
npm run db:seed
npx playwright install chromium
npm run test:e2e
```

The Playwright web server is started by the project configuration. E2E seed credentials are disposable and must never be reused in production.

## 4. Verify a clean migration install

To prove migrations can create the schema from scratch, use a newly created empty test database (for example `clientflow_migration_test`), set `DATABASE_URL` to it, and run:

```powershell
npm run db:deploy
npm run db:deploy
```

The first run must apply every committed migration. The second run must complete without pending migrations. To inspect the resulting schema, use:

```powershell
docker compose exec -T postgres psql -U clientflow -d clientflow_test -c "\dt"
```

## 5. Run the remaining local quality checks

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
docker compose config --quiet
docker build -t clientflow:local .
```

For the full browser journey, run `npm run test:e2e` as described above. The CI workflow additionally runs Lighthouse and uploads its HTML report as a GitHub Actions artifact.

## Cleanup

Stop the local PostgreSQL container when finished:

```powershell
docker compose stop postgres
```

To delete the local Compose data volume, including the development database and local uploads, use `docker compose down -v`. This is destructive; do not run it if you need to keep local data.
