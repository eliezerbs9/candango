-- Link a sent signature request back to the deal builder document it was generated from,
-- so it can be duplicated into its pre-PDF canvas state (not the flattened/signed PDF).
ALTER TABLE "SignatureRequest" ADD COLUMN "signableDocumentTemplateId" TEXT;
