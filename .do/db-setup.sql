-- One-time DB role setup per environment (staging, prod).
-- Run as the admin (doadmin) AFTER the first `prisma migrate deploy` (tables must exist):
--   psql "<DIRECT_URL as doadmin>" -f .do/db-setup.sql
-- Creates the non-superuser role the API connects as (subject to RLS).
-- The RLS POLICIES themselves ship via the `row_level_security` Prisma migration.
-- (Set a strong password below first; put it in the candango_app DATABASE_URL secret.)

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'candango_app') THEN
    CREATE ROLE candango_app LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO candango_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO candango_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO candango_app;
-- Future tables/sequences created by the owner get the same grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO candango_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO candango_app;
-- The app role must not touch the migrations bookkeeping table (guarded: the
-- table may not exist yet if this runs before the first migration).
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations') THEN
    EXECUTE 'REVOKE ALL ON TABLE "_prisma_migrations" FROM candango_app';
  END IF;
END $$;

-- Reminder: the WORKER connects as doadmin with RLS bypassed via its connection string:
--   ...?options=-c%20app.bypass_rls%3Don
