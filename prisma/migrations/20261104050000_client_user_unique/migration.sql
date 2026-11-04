-- A user may be linked to at most one client portal profile.
-- PostgreSQL unique indexes allow multiple NULL values, so unlinked clients remain supported.
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");
