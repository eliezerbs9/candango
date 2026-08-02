-- Automations: system category bucket + freeform tags (for filtering the automations view).
ALTER TABLE "EmailAutomation" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "EmailAutomation" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
