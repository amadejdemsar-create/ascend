-- Drop two UserStats columns that were write-only drift:
--   lastActiveDate: never read or written anywhere in the codebase
--   goalsCompleted: only written by gamificationService.awardXp, never
--                   displayed anywhere (the dashboard computes
--                   completed counts inline from Goal.status)
--
-- The application code is updated in the same commit to stop writing
-- goalsCompleted.

ALTER TABLE "UserStats" DROP COLUMN IF EXISTS "lastActiveDate";
ALTER TABLE "UserStats" DROP COLUMN IF EXISTS "goalsCompleted";
