ALTER TABLE "Review" ADD COLUMN "reviewerId" TEXT;
ALTER TABLE "Review" ADD COLUMN "version" INTEGER;
UPDATE "Review" r SET "reviewerId" = c."userId", "version" = d."version"
FROM "Client" c, "Deliverable" d
WHERE r."clientId" = c."id" AND r."deliverableId" = d."id";
ALTER TABLE "Review" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Review_reviewerId_createdAt_idx" ON "Review"("reviewerId", "createdAt");

CREATE TABLE "DeliverableComment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "deliverableId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverableComment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "DeliverableComment" ADD CONSTRAINT "DeliverableComment_deliverableId_workspaceId_fkey"
  FOREIGN KEY ("deliverableId", "workspaceId") REFERENCES "Deliverable"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableComment" ADD CONSTRAINT "DeliverableComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "DeliverableComment_workspaceId_deliverableId_createdAt_idx"
  ON "DeliverableComment"("workspaceId", "deliverableId", "createdAt");
CREATE INDEX "DeliverableComment_authorId_createdAt_idx" ON "DeliverableComment"("authorId", "createdAt");
