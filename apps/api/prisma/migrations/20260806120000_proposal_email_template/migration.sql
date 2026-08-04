-- Email template used for the covering email when a proposal is sent.
ALTER TABLE "ProposalTemplate" ADD COLUMN "emailTemplateId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "emailTemplateId" TEXT;
