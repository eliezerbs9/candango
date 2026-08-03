-- Proposals: reusable templates (theme + layout of areas) and per-deal proposals shared by token.

CREATE TABLE "ProposalTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "theme" JSONB NOT NULL DEFAULT '{}',
    "layout" JSONB NOT NULL DEFAULT '[]',
    "systemKey" TEXT,
    "createdByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProposalTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProposalTemplate_orgId_systemKey_key" ON "ProposalTemplate"("orgId", "systemKey");
CREATE INDEX "ProposalTemplate_orgId_idx" ON "ProposalTemplate"("orgId");
ALTER TABLE "ProposalTemplate" ADD CONSTRAINT "ProposalTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "theme" JSONB NOT NULL DEFAULT '{}',
    "content" JSONB NOT NULL DEFAULT '[]',
    "estimateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "shareToken" TEXT NOT NULL,
    "feedback" TEXT,
    "createdByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Proposal_shareToken_key" ON "Proposal"("shareToken");
CREATE INDEX "Proposal_orgId_dealId_idx" ON "Proposal"("orgId", "dealId");
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProposalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security (mirror the tenant_isolation policy).
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ProposalTemplate','Proposal'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY tenant_isolation ON %I
      USING (current_setting('app.bypass_rls', true) = 'on'
             OR "orgId" = current_setting('app.current_org_id', true))
      WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
             OR "orgId" = current_setting('app.current_org_id', true))$f$, t);
  END LOOP;
END $$;
