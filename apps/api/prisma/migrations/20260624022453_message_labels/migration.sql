-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "labels" TEXT[] DEFAULT ARRAY[]::TEXT[];
