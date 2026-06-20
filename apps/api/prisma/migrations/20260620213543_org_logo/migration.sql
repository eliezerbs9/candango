/*
  Warnings:

  - You are about to drop the `OrganizationBranding` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OrganizationBranding" DROP CONSTRAINT "OrganizationBranding_orgId_fkey";

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "logoUrl" TEXT;

-- DropTable
DROP TABLE "OrganizationBranding";
