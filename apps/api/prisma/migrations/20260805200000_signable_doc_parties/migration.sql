-- A document template declares who signs: one party (client) or both (client + deal owner).
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "parties" TEXT NOT NULL DEFAULT 'one';
