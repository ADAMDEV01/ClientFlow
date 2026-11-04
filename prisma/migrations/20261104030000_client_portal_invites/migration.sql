CREATE TABLE "ClientInvitation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "invitedById" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientInvitation_tokenHash_key" ON "ClientInvitation"("tokenHash");
CREATE UNIQUE INDEX "ClientInvitation_workspaceId_clientId_key" ON "ClientInvitation"("workspaceId", "clientId");
CREATE INDEX "ClientInvitation_workspaceId_status_expiresAt_idx" ON "ClientInvitation"("workspaceId", "status", "expiresAt");
CREATE INDEX "ClientInvitation_email_idx" ON "ClientInvitation"("email");
ALTER TABLE "ClientInvitation" ADD CONSTRAINT "ClientInvitation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientInvitation" ADD CONSTRAINT "ClientInvitation_clientId_workspaceId_fkey"
  FOREIGN KEY ("clientId", "workspaceId") REFERENCES "Client"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientInvitation" ADD CONSTRAINT "ClientInvitation_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
