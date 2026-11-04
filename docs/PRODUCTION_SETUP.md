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

Production uses the AWS S3 SDK. Configure a private AWS S3 bucket, or an S3-compatible provider that supports the S3 `ServerSideEncryption: AES256` request used by this application. Add these Production environment variables:

- `S3_BUCKET`: bucket name.
- `S3_REGION`: bucket region.
- `S3_ACCESS_KEY_ID`: access key with access only to this bucket.
- `S3_SECRET_ACCESS_KEY`: matching secret key.
- `S3_ENDPOINT`: optional for AWS S3; set this only when using a compatible provider endpoint that supports the required SSE-S3 header.

Keep the bucket private; ClientFlow authorizes downloads in the application before retrieving objects. Do not enable public object access. The application uses server-side encryption on S3 uploads. After setting the variables, redeploy and test an upload and authorized download, then verify that a different workspace cannot download the object.

## 3. Invitation email (optional but recommended)

Create a Resend API key and verify the sending domain in Resend. Add:

- `RESEND_API_KEY`: Resend API key.
- `RESEND_FROM_EMAIL`: verified sender, for example `ClientFlow <noreply@your-verified-domain.com>`.
- `NEXT_PUBLIC_APP_URL`: canonical public app origin, for example `https://your-domain.com`.

Without Resend configuration, invitation creation still returns a single-use URL for manual delivery. If Resend is temporarily unavailable or rejects a send, the invitation link remains available and the UI reports that the email was not sent. Invitation tokens are stored as SHA-256 hashes, not plaintext.

## 4. Authentication

Keep `AUTH_SECRET` configured as a strong random secret and `AUTH_URL` set to the canonical application URL. Never expose secrets in client-side variables, source control, logs, or support messages.

## 5. Post-deployment verification

1. Confirm the Production deployment is Ready.
2. Verify `/login` and `/register` return successfully.
3. Create a test workspace and invite a team member; verify email delivery or copy the manual URL.
4. Upload a small allowed file and download it as an authorized user.
5. Confirm a user from another workspace cannot access that file.
6. Invite a client and verify the client portal acceptance flow.
7. Review runtime logs for provider/storage errors without logging secrets or invitation tokens.
