-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable: Add recurring goal fields
ALTER TABLE "Goal" ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Goal" ADD COLUMN "recurringFrequency" "RecurringFrequency";
ALTER TABLE "Goal" ADD COLUMN "recurringInterval" INTEGER DEFAULT 1;
ALTER TABLE "Goal" ADD COLUMN "recurringSourceId" TEXT;
ALTER TABLE "Goal" ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Goal" ADD COLUMN "longestStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Goal" ADD COLUMN "lastCompletedInstance" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_recurringSourceId_fkey" FOREIGN KEY ("recurringSourceId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Goal_recurringSourceId_idx" ON "Goal"("recurringSourceId");
