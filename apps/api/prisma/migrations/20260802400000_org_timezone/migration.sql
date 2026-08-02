-- Workspace IANA timezone (captured at signup, required for timezone-aware automations).
ALTER TABLE "Organization" ADD COLUMN "timezone" TEXT;
