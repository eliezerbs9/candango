-- Convert single-string address → structured jsonb { line1 } (kept null when empty)
ALTER TABLE "Company" ALTER COLUMN "address" TYPE JSONB
  USING (CASE WHEN "address" IS NULL OR "address" = '' THEN NULL ELSE jsonb_build_object('line1', "address") END);
ALTER TABLE "Person" ALTER COLUMN "address" TYPE JSONB
  USING (CASE WHEN "address" IS NULL OR "address" = '' THEN NULL ELSE jsonb_build_object('line1', "address") END);
