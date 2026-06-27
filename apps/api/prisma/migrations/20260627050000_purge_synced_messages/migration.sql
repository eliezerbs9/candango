-- Purge full-inbox-sync messages (no-CASA launch — full sync is disabled, FR-5.8).
-- Synced messages (from the old GmailSyncProcessor) carry NO rfcMessageId.
-- BCC/Reply-To-captured (inbound webhook) and CRM-sent messages always set rfcMessageId,
-- so they are preserved; only the synced inbox mirror is removed.
DELETE FROM "Message" WHERE "rfcMessageId" IS NULL;
