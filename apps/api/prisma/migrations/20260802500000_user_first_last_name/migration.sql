-- User: split single `name` into firstName + lastName (keep derived `name`), mirroring Person.
ALTER TABLE "User" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';

-- Backfill from the existing name: first whitespace token → firstName, the rest → lastName.
UPDATE "User"
SET "firstName" = split_part(btrim(regexp_replace(COALESCE("name", ''), '\s+', ' ', 'g')), ' ', 1),
    "lastName"  = btrim(
      substr(
        btrim(regexp_replace(COALESCE("name", ''), '\s+', ' ', 'g')),
        length(split_part(btrim(regexp_replace(COALESCE("name", ''), '\s+', ' ', 'g')), ' ', 1)) + 1
      )
    )
WHERE "name" IS NOT NULL;
