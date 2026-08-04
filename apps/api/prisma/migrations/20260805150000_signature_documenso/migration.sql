-- E-signature engine migration to Documenso: correlate requests by Documenso document id.
ALTER TABLE "SignatureRequest" ADD COLUMN "documensoDocumentId" INTEGER;
CREATE UNIQUE INDEX "SignatureRequest_documensoDocumentId_key" ON "SignatureRequest"("documensoDocumentId");
