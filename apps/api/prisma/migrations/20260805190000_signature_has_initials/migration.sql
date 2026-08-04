-- Track whether a signature request includes an initials field (shown on the deal card).
ALTER TABLE "SignatureRequest" ADD COLUMN "hasInitials" BOOLEAN NOT NULL DEFAULT false;
