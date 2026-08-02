-- Local estimate items catalog + sales-tax rate (basis points) on the org and docs.
ALTER TABLE "Organization" ADD COLUMN "taxRateBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DealEstimate" ADD COLUMN "taxRateBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DealInvoice" ADD COLUMN "taxRateBps" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "EstimateItem" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "unitPrice" INTEGER,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EstimateItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EstimateItem_orgId_idx" ON "EstimateItem"("orgId");
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
