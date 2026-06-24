/*
  Warnings:

  - You are about to drop the `QuickBooksEstimate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuickBooksInvoice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "QuickBooksEstimate" DROP CONSTRAINT "QuickBooksEstimate_dealId_fkey";

-- DropForeignKey
ALTER TABLE "QuickBooksEstimate" DROP CONSTRAINT "QuickBooksEstimate_orgId_fkey";

-- DropForeignKey
ALTER TABLE "QuickBooksInvoice" DROP CONSTRAINT "QuickBooksInvoice_dealId_fkey";

-- DropForeignKey
ALTER TABLE "QuickBooksInvoice" DROP CONSTRAINT "QuickBooksInvoice_orgId_fkey";

-- DropTable
DROP TABLE "QuickBooksEstimate";

-- DropTable
DROP TABLE "QuickBooksInvoice";

-- CreateTable
CREATE TABLE "DealEstimate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'native',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "docNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "txnDate" TIMESTAMP(3),
    "notes" TEXT,
    "qbId" TEXT,
    "qbSyncToken" TEXT,
    "qbSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DealEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealEstimateLine" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "qbLineId" TEXT,

    CONSTRAINT "DealEstimateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealInvoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'native',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "docNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "txnDate" TIMESTAMP(3),
    "notes" TEXT,
    "sourceEstimateId" TEXT,
    "qbId" TEXT,
    "qbSyncToken" TEXT,
    "qbSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DealInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "qbLineId" TEXT,

    CONSTRAINT "DealInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealEstimate_orgId_dealId_idx" ON "DealEstimate"("orgId", "dealId");

-- CreateIndex
CREATE UNIQUE INDEX "DealEstimate_orgId_source_qbId_key" ON "DealEstimate"("orgId", "source", "qbId");

-- CreateIndex
CREATE INDEX "DealEstimateLine_estimateId_idx" ON "DealEstimateLine"("estimateId");

-- CreateIndex
CREATE INDEX "DealInvoice_orgId_dealId_idx" ON "DealInvoice"("orgId", "dealId");

-- CreateIndex
CREATE UNIQUE INDEX "DealInvoice_orgId_source_qbId_key" ON "DealInvoice"("orgId", "source", "qbId");

-- CreateIndex
CREATE INDEX "DealInvoiceLine_invoiceId_idx" ON "DealInvoiceLine"("invoiceId");

-- AddForeignKey
ALTER TABLE "DealEstimate" ADD CONSTRAINT "DealEstimate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEstimate" ADD CONSTRAINT "DealEstimate_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEstimateLine" ADD CONSTRAINT "DealEstimateLine_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "DealEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInvoice" ADD CONSTRAINT "DealInvoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInvoice" ADD CONSTRAINT "DealInvoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInvoice" ADD CONSTRAINT "DealInvoice_sourceEstimateId_fkey" FOREIGN KEY ("sourceEstimateId") REFERENCES "DealEstimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInvoiceLine" ADD CONSTRAINT "DealInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "DealInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
