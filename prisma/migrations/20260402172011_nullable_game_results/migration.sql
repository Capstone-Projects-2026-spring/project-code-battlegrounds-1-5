-- DropForeignKey
ALTER TABLE "GameResult" DROP CONSTRAINT "GameResult_winningTeamId_fkey";

-- AlterTable
ALTER TABLE "GameResult" ALTER COLUMN "winningTeamId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
