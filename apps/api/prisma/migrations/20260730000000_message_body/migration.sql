-- Store the full email body on capture/send. We have no Gmail read scope
-- (only gmail.send), so the body can't be fetched from Gmail later — we keep
-- it ourselves: from the Brevo inbound webhook (received) and from our own
-- sends (outbound).
ALTER TABLE "Message" ADD COLUMN "bodyHtml" TEXT;
ALTER TABLE "Message" ADD COLUMN "bodyText" TEXT;
