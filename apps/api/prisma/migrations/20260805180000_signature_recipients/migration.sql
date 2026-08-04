-- Store the signers + their signing links so the workspace can sign its own part from the deal.
ALTER TABLE "SignatureRequest" ADD COLUMN "recipients" JSONB NOT NULL DEFAULT '[]';
