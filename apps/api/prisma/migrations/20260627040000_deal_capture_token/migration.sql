-- Per-deal BCC capture address token + RFC Message-ID for send/BCC dedupe — FR-5.8
-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "emailCaptureToken" TEXT;
ALTER TABLE "Message" ADD COLUMN "rfcMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Deal_emailCaptureToken_key" ON "Deal"("emailCaptureToken");
CREATE INDEX "Message_orgId_rfcMessageId_idx" ON "Message"("orgId", "rfcMessageId");
