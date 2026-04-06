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

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,

    CONSTRAINT "PartyMember_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
