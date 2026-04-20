-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "onboardingComplete" SET DEFAULT false;

-- CreateTable
CREATE TABLE "Todo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "goalId" TEXT,
    "categoryId" TEXT,
    "dueDate" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "recurringSourceId" TEXT,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedDate" TIMESTAMP(3),
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isBig3" BOOLEAN NOT NULL DEFAULT false,
    "big3Date" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Todo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categoryId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedEntryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Todo_userId_idx" ON "Todo"("userId");

-- CreateIndex
CREATE INDEX "Todo_goalId_idx" ON "Todo"("goalId");

-- CreateIndex
CREATE INDEX "Todo_categoryId_idx" ON "Todo"("categoryId");

-- CreateIndex
CREATE INDEX "Todo_dueDate_idx" ON "Todo"("dueDate");

-- CreateIndex
CREATE INDEX "Todo_scheduledDate_idx" ON "Todo"("scheduledDate");

-- CreateIndex
CREATE INDEX "Todo_status_userId_idx" ON "Todo"("status", "userId");

-- CreateIndex
CREATE INDEX "Todo_recurringSourceId_idx" ON "Todo"("recurringSourceId");

-- CreateIndex
CREATE INDEX "Todo_isBig3_big3Date_userId_idx" ON "Todo"("isBig3", "big3Date", "userId");

-- CreateIndex
CREATE INDEX "ContextEntry_userId_idx" ON "ContextEntry"("userId");

-- CreateIndex
CREATE INDEX "ContextEntry_categoryId_idx" ON "ContextEntry"("categoryId");

-- CreateIndex
CREATE INDEX "ContextEntry_userId_title_idx" ON "ContextEntry"("userId", "title");

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_recurringSourceId_fkey" FOREIGN KEY ("recurringSourceId") REFERENCES "Todo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextEntry" ADD CONSTRAINT "ContextEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextEntry" ADD CONSTRAINT "ContextEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
