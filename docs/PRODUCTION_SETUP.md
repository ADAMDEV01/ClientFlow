# Production service setup

ClientFlow needs PostgreSQL, private S3-compatible object storage, and (optionally) Resend for invitation emails.

## 1. PostgreSQL

Set `DATABASE_URL` to the production PostgreSQL connection string in the deployment environment. Before applying migrations, run the duplicate-client preflight against that same database:

```bash
npm ci
npm run db:generate
npm run db:preflight:client-user-unique
npm run db:deploy
```

Only run `db:deploy` when the preflight reports `PASSED`. If it reports duplicates or cannot connect, stop and resolve the database issue first. Do not paste the connection string into chat or commit it to the repository.

## 2. Private file storage (required)

Production uses the AWS S3 SDK. Configure a private AWS S3 bucket or a compatible provider such as Cloudflare R2. Add these Production environment variables:

- `S3_BUCKET`: bucket name.
- `S3_REGION`: bucket region (for Cloudflare R2, use `auto`).
- `S3_ACCESS_KEY_ID`: access key restricted to this bucket.
- `S3_SECRET_ACCESS_KEY`: matching secret key.
- `S3_ENDPOINT`: optional for AWS S3; for Cloudflare R2 use `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
- `S3_SERVER_SIDE_ENCRYPTION`: `AES256` for AWS S3 (default); set to `NONE` for Cloudflare R2 because R2 does not implement the S3 SSE request header and encrypts all objects at rest automatically.

Keep the bucket private; ClientFlow authorizes downloads in the application before retrieving objects. Do not enable public object access. AWS S3 uploads request SSE-S3 encryption; Cloudflare R2 provides automatic AES-256 encryption at rest. After setting the variables, redeploy and test an upload and authorized download, then verify that a different workspace cannot download the object.

## 3. Invitation email (optional but recommended)

Create a Resend API key and verify the sending domain in Resend. Add:

- `RESEND_API_KEY`: Resend API key.
- `RESEND_FROM_EMAIL`: verified sender, for example `ClientFlow <noreply@your-verified-domain.com>`.
- `NEXT_PUBLIC_APP_URL`: canonical public app origin, for example `https://your-domain.com`.

Without Resend configuration, invitation creation still returns a single-use URL for manual delivery. If Resend is temporarily unavailable or rejects a send, the invitation link remains available and the UI reports that the email was not sent. Invitation tokens are stored as SHA-256 hashes, not plaintext.

## 4. Expired rate-limit cleanup

The repository includes a daily GitHub Actions workflow at 03:17 UTC and a manual `workflow_dispatch` trigger. Add a repository Actions secret named `PRODUCTION_DATABASE_URL` containing the production PostgreSQL connection string. The workflow runs `npm ci`, generates the Prisma client, and deletes expired `RateLimitBucket` rows in batches of at most 10,000 using row locks with `SKIP LOCKED`; active buckets are not eligible for deletion. Run the workflow manually once after adding the secret and confirm it completes successfully. Do not expose the connection string in workflow logs.

## 5. Authentication

Generate a unique `AUTH_SECRET` with at least 32 random bytes (for example, `openssl rand -base64 32`). Set `AUTH_URL` to the canonical production origin using `https://`. When invitation email is enabled, set `NEXT_PUBLIC_APP_URL` to that same canonical HTTPS origin. Never expose secrets in client-side variables, source control, logs, or support messages.

## 6. Post-deployment verification

1. Confirm the Production deployment is Ready.
2. Verify `/login` and `/register` return successfully.
3. Create a test workspace and invite a team member; verify email delivery or copy the manual URL.
4. Upload a small allowed file and download it as an authorized user.
5. Confirm a user from another workspace cannot access that file.
6. Invite a client and verify the client portal acceptance flow.
7. Review runtime logs for provider/storage errors without logging secrets or invitation tokens.
8. Confirm the scheduled rate-limit cleanup workflow is enabled and its manual run succeeds.
