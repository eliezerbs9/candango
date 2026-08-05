-- A contact's job title is company-specific (a person can have different roles at different companies),
-- so it lives on the company↔person relationship, not on the person.
ALTER TABLE "CompanyContact" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Person" DROP COLUMN IF EXISTS "title";
