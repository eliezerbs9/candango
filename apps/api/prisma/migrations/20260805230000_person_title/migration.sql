-- People gain a job title / position (e.g. "Procurement Manager"), exposed as {{receiver.title}}.
ALTER TABLE "Person" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
