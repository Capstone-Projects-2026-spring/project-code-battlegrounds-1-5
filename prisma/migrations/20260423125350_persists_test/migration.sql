/*
  Warnings:

  - You are about to drop the column `team1TimeToPassMs` on the `GameResult` table. All the data in the column will be lost.
  - You are about to drop the column `team2TimeToPassMs` on the `GameResult` table. All the data in the column will be lost.
  - Added the required column `gameRoomId` to the `GameTest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameResult" DROP COLUMN "team1TimeToPassMs",
DROP COLUMN "team2TimeToPassMs";

-- AlterTable
ALTER TABLE "GameTest" ADD COLUMN     "actualOutput" JSONB,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "executionTimeMs" INTEGER,
ADD COLUMN     "gameRoomId" TEXT NOT NULL,
ADD COLUMN     "passed" BOOLEAN,
ADD COLUMN     "stderr" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Game',
ALTER COLUMN "testCaseId" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "GameTest_gameRoomId_idx" ON "GameTest"("gameRoomId");

-- CreateIndex
CREATE INDEX "GameTest_gameResultId_teamNumber_type_idx" ON "GameTest"("gameResultId", "teamNumber", "type");

-- CreateIndex
CREATE INDEX "GameTest_gameRoomId_teamNumber_idx" ON "GameTest"("gameRoomId", "teamNumber");
