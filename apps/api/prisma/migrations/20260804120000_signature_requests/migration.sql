-- Documents sent for e-signature (self-hosted DocuSeal). See 06 - Delivery/E-Signature — Design & Plan.

CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "signerName" TEXT,
    "signerEmail" TEXT,
    "sourceFileKey" TEXT,
    "signedFileKey" TEXT,
    "auditUrl" TEXT,
    "docusealSubmissionId" TEXT,
    "createdByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SignatureRequest_docusealSubmissionId_key" ON "SignatureRequest"("docusealSubmissionId");
CREATE INDEX "SignatureRequest_orgId_dealId_idx" ON "SignatureRequest"("orgId", "dealId");
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security (mirror the tenant_isolation policy).
ALTER TABLE "SignatureRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignatureRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SignatureRequest"
  USING (current_setting('app.bypass_rls', true) = 'on'
         OR "orgId" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
         OR "orgId" = current_setting('app.current_org_id', true));
