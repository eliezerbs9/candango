-- Person: split single `name` into firstName + lastName (keep derived `name`).
ALTER TABLE "Person" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Person" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';

-- Backfill from the existing name: first whitespace token → firstName, the rest → lastName.
UPDATE "Person"
SET "firstName" = split_part(btrim(regexp_replace("name", '\s+', ' ', 'g')), ' ', 1),
    "lastName"  = btrim(
      substr(
        btrim(regexp_replace("name", '\s+', ' ', 'g')),
        length(split_part(btrim(regexp_replace("name", '\s+', ' ', 'g')), ' ', 1)) + 1
      )
    );

-- Organization: how a QuickBooks customer name is built from a person.
ALTER TABLE "Organization" ADD COLUMN "qboNameFormat" TEXT NOT NULL DEFAULT 'first_last';
