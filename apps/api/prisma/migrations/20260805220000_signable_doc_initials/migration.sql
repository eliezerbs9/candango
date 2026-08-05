-- Document templates: initials rule (footer initials on generated docs) + which party initials
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "initialsRule" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "initialsPages" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "initialsParty" TEXT NOT NULL DEFAULT 'client';
