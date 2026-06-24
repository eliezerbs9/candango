-- Per-tenant readable deal number + invoice source-estimate list
ALTER TABLE "Organization" ADD COLUMN "dealSeq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Deal" ADD COLUMN "refNumber" INTEGER;
ALTER TABLE "DealInvoice" ADD COLUMN "sourceEstimateIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX "Deal_orgId_refNumber_key" ON "Deal"("orgId", "refNumber");
