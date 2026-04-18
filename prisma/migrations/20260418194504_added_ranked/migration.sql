-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'RANKED';

-- AlterTable
ALTER TABLE "TeamPlayer" ADD COLUMN     "eloAtGame" INTEGER;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "elo" INTEGER NOT NULL DEFAULT 1000;
