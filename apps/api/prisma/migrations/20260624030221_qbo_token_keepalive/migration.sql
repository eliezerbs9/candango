-- AlterTable
ALTER TABLE "QuickBooksConnection" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastRefreshAt" TIMESTAMP(3),
ADD COLUMN     "refreshTokenExpiry" TIMESTAMP(3);
