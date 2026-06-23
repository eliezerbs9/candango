-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "conferenceUrl" TEXT,
ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "locationType" TEXT,
ADD COLUMN     "startAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ActivityParticipant" (
    "activityId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "ActivityParticipant_pkey" PRIMARY KEY ("activityId","personId")
);

-- CreateIndex
CREATE INDEX "ActivityParticipant_personId_idx" ON "ActivityParticipant"("personId");

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
