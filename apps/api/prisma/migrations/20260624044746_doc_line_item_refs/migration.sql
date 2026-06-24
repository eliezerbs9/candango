-- AlterTable
ALTER TABLE "DealEstimateLine" ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "itemName" TEXT;

-- AlterTable
ALTER TABLE "DealInvoiceLine" ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "itemName" TEXT;
