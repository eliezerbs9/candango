-- Multi-tenant Row-Level Security (defense in depth). See [[Multi-Tenancy & Security]].
--
-- Each policy grants access when EITHER:
--   * app.bypass_rls = 'on'  — trusted / unscoped paths (unauthenticated routes, the
--     Stripe webhook, background/startup code) set this via the Prisma tenant extension; or
--   * the row's orgId matches app.current_org_id — set per query for authenticated requests.
-- Neither set ⇒ no rows visible (fail-closed). Superusers bypass RLS entirely, so the
-- migration owner and the worker (which connects as the superuser) are unaffected.

-- Tenant tables that carry an "orgId" column.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User','AuthToken','Team','Role','Pipeline','Stage','Deal','Person','Company',
    'Activity','DealStageEvent','Note','CalendarConnection','CalendarEvent',
    'MailboxConnection','Message','Webhook','WebhookDelivery','EventOutbox',
    'ApiKey','AuditLog','Subscription','Invoice','CustomFieldDefinition',
    'QuickBooksConnection','QuickBooksCustomerLink','DealEstimate','DealInvoice'
  ] LOOP
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

-- Organization: its own id is the tenant key.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Organization";
CREATE POLICY tenant_isolation ON "Organization"
  USING (current_setting('app.bypass_rls', true) = 'on'
         OR "id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
         OR "id" = current_setting('app.current_org_id', true));

-- Child / join tables (no "orgId"): scope through their parent's orgId.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('CompanyContact','Company','companyId'),
    ('DealParticipant','Deal','dealId'),
    ('ActivityParticipant','Activity','activityId'),
    ('DealEstimateLine','DealEstimate','estimateId'),
    ('DealInvoiceLine','DealInvoice','invoiceId')
  ) AS v(child, parent, fk) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.child);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.child);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', r.child);
    EXECUTE format($f$CREATE POLICY tenant_isolation ON %I
      USING (current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (SELECT 1 FROM %I p WHERE p.id = %I.%I
                   AND p."orgId" = current_setting('app.current_org_id', true)))
      WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (SELECT 1 FROM %I p WHERE p.id = %I.%I
                   AND p."orgId" = current_setting('app.current_org_id', true)))$f$,
      r.child, r.parent, r.child, r.fk, r.parent, r.child, r.fk);
  END LOOP;
END $$;
