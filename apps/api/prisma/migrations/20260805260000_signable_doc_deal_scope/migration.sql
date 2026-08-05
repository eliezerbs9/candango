-- Document templates can be a one-off built for a specific deal (hidden from the reusable templates list).
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "dealId" TEXT;
