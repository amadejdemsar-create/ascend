-- Add todoId relation to XpEvent so todoService.uncomplete can reverse
-- XP awards cleanly by finding the originating event.
--
-- WARNING: the auto-generated migration also contained DROP statements
-- for the ContextEntry search_vector column and its index because that
-- column lives in a raw SQL migration (20260409114539_add_context_fts)
-- and is invisible to Prisma. Those DROPs have been removed and the
-- raw FTS migration has been re-applied on top of this one to restore
-- the column. DO NOT re-add the DROPs. See CLAUDE.md safety rule 6 and
-- the warning comment above `model ContextEntry` in schema.prisma.

-- AlterTable
ALTER TABLE "XpEvent" ADD COLUMN     "todoId" TEXT;

-- CreateIndex
CREATE INDEX "XpEvent_todoId_idx" ON "XpEvent"("todoId");

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
