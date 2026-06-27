-- Store the connected Gmail address so sending no longer needs a Gmail read scope (drop gmail.modify) — FR-5.8
ALTER TABLE "MailboxConnection" ADD COLUMN "email" TEXT;
