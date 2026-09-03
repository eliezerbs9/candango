-- CompanyCam integration: a per-org OAuth connection + the deal ↔ CompanyCam project link.

CREATE TABLE "CompanyCamConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "lastRefreshAt" TIMESTAMP(3),
    "lastError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCamConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyCamConnection_orgId_key" ON "CompanyCamConnection"("orgId");

ALTER TABLE "CompanyCamConnection" ADD CONSTRAINT "CompanyCamConnection_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CompanyCamProjectLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCamProjectLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyCamProjectLink_dealId_key" ON "CompanyCamProjectLink"("dealId");
CREATE INDEX "CompanyCamProjectLink_orgId_idx" ON "CompanyCamProjectLink"("orgId");

ALTER TABLE "CompanyCamProjectLink" ADD CONSTRAINT "CompanyCamProjectLink_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyCamProjectLink" ADD CONSTRAINT "CompanyCamProjectLink_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security — both carry "orgId", so they join the tenant_isolation policy from
-- 20260624160000_row_level_security. Layer 2 of the isolation; the matching TENANT_MODELS entries
-- in apps/api/src/prisma/prisma.service.ts are Layer 1. Always ship the two together.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['CompanyCamConnection','CompanyCamProjectLink'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$CREATE POLICY tenant_isolation ON %I
      USING (current_setting('app.bypass_rls', true) = 'on'
             OR "orgId" = current_setting('app.current_org_id', true))
      WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
             OR "orgId" = current_setting('app.current_org_id', true))$f$, t);
  END LOOP;
END $$;
