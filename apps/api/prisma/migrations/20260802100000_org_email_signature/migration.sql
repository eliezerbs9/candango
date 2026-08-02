-- Configurable per-workspace email signature ({ photo, name, email, phone, logo, text }); null = default.
ALTER TABLE "Organization" ADD COLUMN "emailSignature" JSONB;
