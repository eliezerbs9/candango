-- Proposal internal (required/hidden) fields — rep-filled, client-hidden, feed automations.
ALTER TABLE "ProposalTemplate" ADD COLUMN "fields" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Proposal" ADD COLUMN "fields" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Proposal" ADD COLUMN "fieldValues" JSONB NOT NULL DEFAULT '{}';
