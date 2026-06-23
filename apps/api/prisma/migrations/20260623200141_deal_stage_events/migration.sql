-- CreateTable
CREATE TABLE "DealStageEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealStageEvent_dealId_createdAt_idx" ON "DealStageEvent"("dealId", "createdAt");

-- AddForeignKey
ALTER TABLE "DealStageEvent" ADD CONSTRAINT "DealStageEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
