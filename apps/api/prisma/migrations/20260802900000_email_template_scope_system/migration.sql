-- Email templates: scope (variable context) + protected system templates.
ALTER TABLE "EmailTemplate" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'deal';
ALTER TABLE "EmailTemplate" ADD COLUMN "systemKey" TEXT;

-- Adopt any already-seeded starter templates as the protected system ones (matched by name),
-- so existing workspaces don't end up with duplicates when seeding runs again. Pick a single row
-- per org (the earliest) to satisfy the (orgId, systemKey) unique index even if names duplicate.
UPDATE "EmailTemplate" e SET "systemKey" = 'send_estimate'
  WHERE e."archivedAt" IS NULL AND e."name" = 'Send estimate'
    AND e."id" = (SELECT MIN(e2."id") FROM "EmailTemplate" e2
                  WHERE e2."orgId" = e."orgId" AND e2."archivedAt" IS NULL AND e2."name" = 'Send estimate');
UPDATE "EmailTemplate" e SET "systemKey" = 'send_invoice'
  WHERE e."archivedAt" IS NULL AND e."name" = 'Send invoice'
    AND e."id" = (SELECT MIN(e2."id") FROM "EmailTemplate" e2
                  WHERE e2."orgId" = e."orgId" AND e2."archivedAt" IS NULL AND e2."name" = 'Send invoice');

-- One template per (org, systemKey). NULLs are allowed to repeat (ordinary templates).
CREATE UNIQUE INDEX "EmailTemplate_orgId_systemKey_key" ON "EmailTemplate"("orgId", "systemKey");
