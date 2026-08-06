-- Track which starter-kit automation recipe groups have already been seeded for an org, so each
-- group (core / gmail / quickbooks) is auto-created at most once — reconnecting an integration
-- never re-seeds.
ALTER TABLE "Organization" ADD COLUMN "seededAutomationGroups" TEXT[] NOT NULL DEFAULT '{}';
