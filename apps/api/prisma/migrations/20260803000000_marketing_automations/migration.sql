-- Marketing automations: scheduled broadcasts to an audience, sharing the EmailAutomation table
-- (so the automations view can filter deal + marketing side by side by category/tags).
ALTER TABLE "EmailAutomation" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'deal';
ALTER TABLE "EmailAutomation" ALTER COLUMN "trigger" SET DEFAULT '';
ALTER TABLE "EmailAutomation" ADD COLUMN "timezone" TEXT;
ALTER TABLE "EmailAutomation" ADD COLUMN "startAt" TIMESTAMP(3);
ALTER TABLE "EmailAutomation" ADD COLUMN "nextRunAt" TIMESTAMP(3);
ALTER TABLE "EmailAutomation" ADD COLUMN "lastRunAt" TIMESTAMP(3);

CREATE INDEX "EmailAutomation_kind_enabled_nextRunAt_idx" ON "EmailAutomation"("kind", "enabled", "nextRunAt");
