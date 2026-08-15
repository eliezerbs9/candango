-- Two tenant tables shipped without row-level security: "EstimateItem" (20260801100000) and
-- "DealEvent" (20260808120000). Bring them in line with the rest of the schema — same
-- tenant_isolation policy as 20260624160000_row_level_security (defense in depth, Layer 2).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['EstimateItem','DealEvent'] LOOP
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
