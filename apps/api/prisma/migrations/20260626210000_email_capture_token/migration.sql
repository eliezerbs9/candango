-- Per-user email capture token (BCC / inbound-parse address local-part) — FR-5.8
-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailCaptureToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailCaptureToken_key" ON "User"("emailCaptureToken");
