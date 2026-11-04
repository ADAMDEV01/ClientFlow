# Client portal

## Client invitations

- Workspace owners and admins can issue an invitation from the Clients page.
- Each invitation uses 32 cryptographically random bytes. Only the SHA-256 token hash is stored.
- Invitations expire after seven days. Reissuing an invitation rotates the token and invalidates the previous link.
- Acceptance checks the invited email against both the invitation and current Client record, atomically consumes the pending invitation, and links the authenticated or newly-created user to that Client.
- A client account is not added as a WorkspaceMember. Its CLIENT role and client profile are loaded from the database by the Auth.js JWT callback.
- In development, the email provider writes a console stub. Configure RESEND_API_KEY and RESEND_FROM_EMAIL to send through Resend. Set NEXT_PUBLIC_APP_URL or AUTH_URL to the public application origin; VERCEL_URL is used as a fallback.

## Portal data isolation

Client portal queries are scoped by workspaceId, clientId, and the authenticated user's Client.userId relation. Project detail queries apply those same filters again. Tasks are filtered with visibleToClient=true in Prisma, and deliverables are filtered to SUBMITTED, APPROVED, and CHANGES_REQUESTED. File downloads repeat client-project authorization and deliverable visibility checks in the Route Handler.

The project list and detail pages compute progress from milestones and client-visible tasks only. Internal tasks are never loaded into client portal responses.

## Verification

Vitest tests assert the exact Prisma where clauses for client project listing and detail queries, including the client ownership relation, visible-task filter, and deliverable status filter. Invitation tests cover SHA-256 token lookup, invited-email matching, single-use consumption, and atomic linking.
