-- Automations gain an action (email OR activity) + a de-dupe log for time-based runs.
ALTER TABLE "EmailAutomation" ALTER COLUMN "templateId" DROP NOT NULL;
ALTER TABLE "EmailAutomation" ADD COLUMN "action" TEXT NOT NULL DEFAULT 'send_email';

CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutomationRun_automationId_dealId_key" ON "AutomationRun"("automationId", "dealId");
CREATE INDEX "AutomationRun_orgId_idx" ON "AutomationRun"("orgId");
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security for the automation + template tables (mirror the tenant_isolation policy).
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['EmailTemplate','EmailAutomation','AutomationRun'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY tenant_isolation ON %I
      USING (current_setting('app.bypass_rls', true) = 'on'
             OR "orgId" = current_setting('app.current_org_id', true))
      WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
             OR "orgId" = current_setting('app.current_org_id', true))$f$, t);
  END LOOP;
END $$;
