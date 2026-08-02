-- Unit of measure on catalog items + doc lines; "apply tax by default" org flag.
ALTER TABLE "EstimateItem" ADD COLUMN "unit" TEXT;
ALTER TABLE "DealEstimateLine" ADD COLUMN "unit" TEXT;
ALTER TABLE "DealInvoiceLine" ADD COLUMN "unit" TEXT;
ALTER TABLE "Organization" ADD COLUMN "taxDefaultOn" BOOLEAN NOT NULL DEFAULT false;
