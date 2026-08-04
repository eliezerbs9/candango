-- Generated-agreement templates (Class A): HTML + variables + inline DocuSeal field tags.
CREATE TABLE "SignableDocumentTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SignableDocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SignableDocumentTemplate_orgId_idx" ON "SignableDocumentTemplate"("orgId");

ALTER TABLE "SignableDocumentTemplate"
  ADD CONSTRAINT "SignableDocumentTemplate_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security (mirror the tenant_isolation policy).
ALTER TABLE "SignableDocumentTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignableDocumentTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SignableDocumentTemplate"
  USING (current_setting('app.bypass_rls', true) = 'on'
         OR "orgId" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
         OR "orgId" = current_setting('app.current_org_id', true));
