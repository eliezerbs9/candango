/*
  Warnings:

  - You are about to drop the column `companyId` on the `Person` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Person" DROP CONSTRAINT "Person_companyId_fkey";

-- DropIndex
DROP INDEX "Person_orgId_companyId_idx";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Person" DROP COLUMN "companyId";

-- CreateTable
CREATE TABLE "CompanyContact" (
    "companyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("companyId","personId")
);

-- CreateIndex
CREATE INDEX "CompanyContact_personId_idx" ON "CompanyContact"("personId");

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
