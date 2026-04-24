-- CreateEnum
CREATE TYPE "ContextEntryType" AS ENUM ('NOTE', 'SOURCE', 'PROJECT', 'PERSON', 'DECISION', 'QUESTION', 'AREA');

-- CreateEnum
CREATE TYPE "ContextLinkType" AS ENUM ('REFERENCES', 'EXTENDS', 'CONTRADICTS', 'SUPPORTS', 'EXAMPLE_OF', 'DERIVED_FROM', 'SUPERSEDES', 'APPLIES_TO', 'PART_OF');

-- CreateEnum
CREATE TYPE "ContextLinkSource" AS ENUM ('CONTENT', 'MANUAL');

-- AlterTable
ALTER TABLE "ContextEntry" ADD COLUMN "type" "ContextEntryType" NOT NULL DEFAULT 'NOTE';

-- CreateTable
CREATE TABLE "ContextLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromEntryId" TEXT NOT NULL,
    "toEntryId" TEXT NOT NULL,
    "type" "ContextLinkType" NOT NULL DEFAULT 'REFERENCES',
    "source" "ContextLinkSource" NOT NULL DEFAULT 'CONTENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContextLink_userId_idx" ON "ContextLink"("userId");

-- CreateIndex
CREATE INDEX "ContextLink_fromEntryId_idx" ON "ContextLink"("fromEntryId");

-- CreateIndex
CREATE INDEX "ContextLink_toEntryId_idx" ON "ContextLink"("toEntryId");

-- CreateIndex
CREATE INDEX "ContextLink_type_idx" ON "ContextLink"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ContextLink_fromEntryId_toEntryId_type_key" ON "ContextLink"("fromEntryId", "toEntryId", "type");

-- AddForeignKey
ALTER TABLE "ContextLink" ADD CONSTRAINT "ContextLink_fromEntryId_fkey" FOREIGN KEY ("fromEntryId") REFERENCES "ContextEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextLink" ADD CONSTRAINT "ContextLink_toEntryId_fkey" FOREIGN KEY ("toEntryId") REFERENCES "ContextEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextLink" ADD CONSTRAINT "ContextLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
