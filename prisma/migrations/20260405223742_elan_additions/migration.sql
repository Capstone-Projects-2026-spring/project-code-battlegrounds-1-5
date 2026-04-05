/*
  Warnings:

  - You are about to drop the column `bestCode` on the `GameResult` table. All the data in the column will be lost.
  - You are about to drop the column `timeToPassMs` on the `GameResult` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "GameResult" DROP CONSTRAINT "GameResult_winningTeamId_fkey";

-- AlterTable
ALTER TABLE "GameResult" DROP COLUMN "bestCode",
DROP COLUMN "timeToPassMs",
ADD COLUMN     "team1Code" TEXT,
ADD COLUMN     "team1TimeToPassMs" INTEGER,
ADD COLUMN     "team2Code" TEXT,
ADD COLUMN     "team2TimeToPassMs" INTEGER,
ALTER COLUMN "winningTeamId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
