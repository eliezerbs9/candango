-- Signature/document templates: parties + second-party source + initials-per-party
ALTER TABLE "SignatureTemplate" ADD COLUMN "parties" TEXT NOT NULL DEFAULT 'one';
ALTER TABLE "SignatureTemplate" ADD COLUMN "party2Source" TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE "SignatureTemplate" ADD COLUMN "party2UserId" TEXT;
ALTER TABLE "SignatureTemplate" ADD COLUMN "initialsParty" TEXT NOT NULL DEFAULT 'client';

ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "party2Source" TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "party2UserId" TEXT;
