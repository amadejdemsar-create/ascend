-- AlterTable: Add onboardingComplete to User
-- DEFAULT true for existing rows (already onboarded), schema default is false for new users
ALTER TABLE "User" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT true;
