# ClientFlow security review

Review scope: application authorization, tenant isolation, server actions, session handling,
rate limiting, uploads/downloads, response headers, and secret configuration.

## Controls verified in code and automated tests

| Area | Control | Verification |
| --- | --- | --- |
| IDOR / tenant isolation | Workspace membership checks are scoped by workspaceId and userId. Client access additionally binds the signed-in user, client profile, project, and workspace. Project/deliverable queries and download checks retain workspace scope. | PostgreSQL integration tests cover cross-workspace team access and cross-client/project access. |
| Role authorization | Sensitive server actions use explicit role allowlists: OWNER/ADMIN/MEMBER for project work, OWNER/ADMIN for invitations and destructive record operations, OWNER for role administration. Client review requires the linked CLIENT profile. | PostgreSQL role/action matrix covers OWNER, ADMIN, MEMBER, and CLIENT. |
| Mass assignment | Server actions pass selected fields into server-side Zod schemas; services construct Prisma data objects field-by-field rather than forwarding request objects. | Unit validation tests and PostgreSQL authorization tests. |
| State transitions | Deliverable status changes use an explicit state machine and conditional updates against expected revision/status. Review, activity, and status changes commit together. | State-machine unit tests and PostgreSQL concurrent-decision integration test. |
| Rate limiting | Database-backed atomic fixed-window counters cover credential login, registration, client invitations, and uploads. | PostgreSQL concurrency test verifies the configured limit under parallel calls. |
| File upload | Uploads are limited to 4 MB, allowlisted MIME types/extensions, checked against file signatures, stored under generated opaque keys, and removed if metadata persistence fails. DOCX/XLSX ZIP central directories and entries are inspected without extraction, with entry-count, expanded-size, compression-ratio, path, encryption, symlink, and checksum limits. Downloads require authenticated workspace/client access and return attachment, private/no-store, and nosniff headers. | Unit tests cover valid DOCX/XLSX archives, missing required entries, truncation, traversal paths, entry-count and expanded-size limits, and compression-ratio rejection; full lifecycle Playwright test uploads a PDF. |
| Session handling | Auth.js uses JWT sessions; authorization guards re-check current workspace membership in the database instead of trusting a workspace ID supplied by the browser. | Unit and PostgreSQL authorization tests. |
| Security headers | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, production HSTS, and a per-request nonce-based Content-Security-Policy are configured; powered-by header is disabled. | Next.js configuration and middleware review. |
| Secrets | The environment example contains placeholders only. Production object-storage credentials and Auth secret are read server-side; CI uses disposable test-only credentials. | Repository configuration review. |

## Finding and hardening applied

- The upload API previously treated a missing Content-Length as zero, allowing a caller to bypass the early request-size check before multipart parsing. The route checks Content-Length when available and also enforces the same maximum while streaming the request body, so chunked requests cannot bypass the bound.
- CI runs PostgreSQL integration tests and the full browser lifecycle independently from the quality/build job.

## Residual deployment requirements and limitations

- Configure a strong, unique AUTH_SECRET and HTTPS AUTH_URL in production. Never reuse CI credentials.
- Configure a private S3-compatible bucket with least-privilege access. Public bucket access must remain disabled; do not expose object keys as public URLs.
- Before deploying the `Client.userId` unique-index migration, install dependencies and generate the Prisma client with `npm ci` and `npm run db:generate`, then run `npm run db:preflight:client-user-unique` against the exact target database. The command exits non-zero and lists duplicate user IDs if a user is linked to multiple client profiles. Resolve duplicates deliberately, rerun the preflight until it reports zero duplicates, then run `npm run db:deploy`. The preflight is read-only; the migration does not unlink or delete client data. Do not run the migration if the preflight cannot connect or reports duplicates.
- Configure shared durable rate-limit storage for horizontally scaled production instances. The current PostgreSQL limiter is shared when all instances use the same database. Expired buckets are removed by `.github/workflows/rate-limit-cleanup.yml`; configure the `PRODUCTION_DATABASE_URL` Actions secret and verify the scheduled/manual workflow succeeds.
- Configure RESEND_API_KEY and RESEND_FROM_EMAIL for real invitation email delivery.
- PDF and image validation checks signatures only; it does not perform full document/image parsing. DOCX/XLSX archives receive structural ZIP inspection with a 1,000-entry cap, 16 MB per expanded entry, 32 MB total expanded size, and 100:1 maximum compression ratio. ZIP64, encrypted, multi-disk, duplicate-path, traversal, symlink, malformed, and checksum-invalid entries are rejected. Malware scanning is explicitly excluded from this release: no antivirus engine or quarantine pipeline is configured. Files remain untrusted and are downloaded as attachments, never rendered inline. Add a dedicated malware-scanning/quarantine pipeline before accepting sensitive or high-risk uploads.
- The nonce-based CSP is enforced for document routes. Keep the policy under review when adding third-party scripts, analytics, embedded media, or external asset hosts; update the allowlist deliberately and verify the production browser console after each integration.
- HSTS is emitted only in production; enable it only when the production domain and all subdomains are HTTPS-ready.
- CI validates against disposable PostgreSQL and local test storage; it does not prove production S3, email, DNS, or hosting secrets are configured.

## Release checklist

- [ ] AUTH_SECRET is unique and at least 32 characters.
- [ ] AUTH_URL and NEXT_PUBLIC_APP_URL use the canonical HTTPS domain.
- [ ] S3 bucket is private, encrypted, and least-privilege.
- [ ] Resend sender domain is verified and delivery is tested.
- [ ] Production database backups and restore procedure are verified.
- [ ] `PRODUCTION_DATABASE_URL` Actions secret is configured and the rate-limit cleanup workflow is verified.
- [x] DOCX/XLSX archive inspection and ZIP-bomb limits are implemented.
- [ ] Malware scanning remains an explicit release exclusion; add a scanner before accepting sensitive/high-risk uploads.
- [ ] Verify CSP reports/console output on the deployed domain and add only required third-party origins.
