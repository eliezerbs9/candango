-- Contact labels (tags) + per-person marketing email opt-out with a tokenized unsubscribe link.
ALTER TABLE "Person" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Person" ADD COLUMN "emailSubscribed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Person" ADD COLUMN "emailUnsubscribedAt" TIMESTAMP(3);
ALTER TABLE "Person" ADD COLUMN "emailUnsubToken" TEXT;

-- Backfill a unique token for every existing person, then lock the column down.
UPDATE "Person" SET "emailUnsubToken" = gen_random_uuid()::text WHERE "emailUnsubToken" IS NULL;
ALTER TABLE "Person" ALTER COLUMN "emailUnsubToken" SET NOT NULL;
CREATE UNIQUE INDEX "Person_emailUnsubToken_key" ON "Person"("emailUnsubToken");

ALTER TABLE "Company" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
