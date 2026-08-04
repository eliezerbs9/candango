-- Signature Templates: reusable field-layout recipes applied when requesting a signature.
CREATE TABLE "SignatureTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initialsRule" TEXT NOT NULL DEFAULT 'none',
    "initialsPages" JSONB NOT NULL DEFAULT '[]',
    "acceptance" BOOLEAN NOT NULL DEFAULT true,
    "acceptanceText" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "requireCounterSigner" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SignatureTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SignatureTemplate_orgId_idx" ON "SignatureTemplate"("orgId");

ALTER TABLE "SignatureTemplate"
  ADD CONSTRAINT "SignatureTemplate_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Link a request to the template whose rules were applied (+ per-request drawn fields).
ALTER TABLE "SignatureRequest" ADD COLUMN "signatureTemplateId" TEXT;
ALTER TABLE "SignatureRequest" ADD COLUMN "drawnFields" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "SignatureRequest"
  ADD CONSTRAINT "SignatureRequest_signatureTemplateId_fkey"
  FOREIGN KEY ("signatureTemplateId") REFERENCES "SignatureTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security (mirror the tenant_isolation policy).
ALTER TABLE "SignatureTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignatureTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SignatureTemplate"
  USING (current_setting('app.bypass_rls', true) = 'on'
         OR "orgId" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
         OR "orgId" = current_setting('app.current_org_id', true));
