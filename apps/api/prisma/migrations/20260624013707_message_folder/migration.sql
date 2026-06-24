-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "folder" TEXT NOT NULL DEFAULT 'inbox';

-- CreateIndex
CREATE INDEX "Message_userId_folder_sentAt_idx" ON "Message"("userId", "folder", "sentAt");
