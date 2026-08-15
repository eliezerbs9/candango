-- Deal Activity timeline: system/automation events (automation runs, proposal responses, signature lifecycle)
CREATE TABLE "DealEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealEvent_dealId_createdAt_idx" ON "DealEvent"("dealId", "createdAt");

ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
