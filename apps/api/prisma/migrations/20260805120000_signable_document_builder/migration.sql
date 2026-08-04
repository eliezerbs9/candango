-- Signable document templates gain a visual builder + upload mode (alongside raw HTML).
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'html';
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "layout" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "theme" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "fileKey" TEXT;
ALTER TABLE "SignableDocumentTemplate" ADD COLUMN "fields" JSONB NOT NULL DEFAULT '[]';
