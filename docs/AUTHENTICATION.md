# Authentication and authorization

## Registration and login

- Registration validates the name, email, password, and workspace name with Zod.
- Passwords are hashed with Argon2id before persistence.
- User creation, workspace creation, OWNER membership, active-workspace selection, and the initial audit event run in one Prisma transaction.
- A unique database-backed rate-limit bucket throttles registration and credential login attempts.
- Auth.js Credentials uses JWT sessions; the session exposes `userId`, `activeWorkspaceId`, workspace ID, role, and optional client profile ID.

## Active workspace

`User.activeWorkspaceId` is persisted with a nullable FK to Workspace (`ON DELETE SET NULL`). The switch action first checks that the authenticated user is a member of the requested workspace, then updates this field. The Auth.js JWT callback reloads the active membership from the database, so the role is derived from the selected workspace rather than from client-submitted data.

## Server authorization

Use `src/server/authz.ts` in Server Actions, Route Handlers, and server queries:

- `requireUser()` rejects anonymous requests.
- `requireWorkspaceMember(workspaceId)` checks membership against both workspace and authenticated user.
- `requireRole(workspaceId, roles)` checks the role returned by the database membership lookup.
- `requireClientProjectAccess(workspaceId, projectId)` scopes the project to the authenticated client's linked profile and workspace.

All guards throw `AuthzError` with a stable code. Compatibility aliases remain for existing service imports.

## Route boundaries

- `src/middleware.ts` redirects unauthenticated requests to `/login` and separates team routes (`/app`) from client routes (`/portal`).
- Route-group layouts at `src/app/(app)/layout.tsx` and `src/app/(portal)/layout.tsx` repeat the role boundary on the server.
- Middleware is a navigation gate, not the authorization source of truth. Data access and every mutation must still call the server authorization helpers.

## Tests

Vitest covers unauthenticated access, cross-workspace membership rejection, role rejection, and client-project scoping. Playwright verifies unauthenticated redirects for both protected route areas.
