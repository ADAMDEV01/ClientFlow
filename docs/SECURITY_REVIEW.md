# Phase 7 — Security review

This checklist records the controls verified in the repository and the remaining deployment checks. It is not a substitute for a production penetration test.

## Application controls reviewed

- [x] **IDOR / tenant isolation:** workspace membership guards query membership by both workspace and authenticated user; project and deliverable lookups are scoped by workspace; client access additionally scopes by the linked client profile and user ID.
- [x] **Client file access:** download repeats client/project ownership checks and only exposes deliverables in SUBMITTED, APPROVED, or CHANGES_REQUESTED states. Team downloads require workspace membership.
- [x] **Mass assignment:** server actions parse input with Zod schemas and construct Prisma data objects from explicitly selected fields; caller-supplied role, workspace ownership, and audit actor IDs are not blindly spread into writes.
- [x] **Rate limiting:** registration, login, and client invitation issuance use atomic database-backed fixed-window buckets. Login is limited per normalized email; registration per normalized email; invitation issuance per workspace and actor.
- [x] **File upload abuse:** upload is authenticated and workspace-scoped; a shared database-backed limit of 20 uploads per user/workspace per hour is enforced; request content length and file size are capped; MIME type, extension, and file signature are checked; object keys are generated server-side; storage keys reject traversal; failed DB writes delete the uploaded object.
- [x] **Session handling:** Auth.js uses JWT sessions; the session callback derives role/workspace/client identifiers from persisted database relationships; server actions re-check authorization against the database rather than trusting the role claim alone.
- [x] **Secrets:** S3 credentials and Auth.js secret are read server-side; no credentials are returned in action/query payloads. CI uses explicitly non-production credentials.
- [ ] **Security headers:** verify the deployed response includes HSTS (HTTPS only), frame protection, nosniff, referrer policy, and a restrictive permissions policy. Configure CSP after auditing Next.js inline scripts/styles and any external asset origins.
- [ ] **Production rate-limit topology:** the database limiter is shared across app instances, but verify bucket cleanup/retention and operational thresholds under expected traffic.
- [ ] **Production storage:** confirm the S3 bucket is private, public access is blocked, encryption is enabled, lifecycle/retention is configured, and IAM credentials are least-privilege.
- [ ] **Operational secrets:** rotate any credentials ever exposed in logs or local files; configure AUTH_SECRET, DATABASE_URL, S3 credentials, RESEND credentials, and the canonical application URL in the deployment provider.

## Threat-oriented test coverage

- Authorization matrix for OWNER, ADMIN, MEMBER, CLIENT, unauthenticated, and cross-workspace identities.
- Cross-workspace resource-ID substitution for projects, deliverables, and client portal access.
- Invalid deliverable state transitions and stale-revision concurrent updates.
- Upload boundary tests for oversized, empty, mismatched MIME/extension/signature, and storage cleanup failures.
- Session role changes and stale JWT behavior.
- Login, registration, and invitation rate-limit boundaries.

## Review notes

The upload route currently relies on the framework/runtime request-body limit in addition to the post-parse 4 MiB file check. Configure a hosting-level request-body ceiling as defense in depth. The current email provider stub is not a security control; production email delivery must be configured separately.
