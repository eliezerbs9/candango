-- A company can designate a primary contact (used for {{company.contact.*}}).
ALTER TABLE "Company" ADD COLUMN "primaryContactId" TEXT;
