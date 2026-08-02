-- Email templates: raw-HTML body option + simple tags.
ALTER TABLE "EmailTemplate" ADD COLUMN "bodyFormat" TEXT NOT NULL DEFAULT 'richtext';
ALTER TABLE "EmailTemplate" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
