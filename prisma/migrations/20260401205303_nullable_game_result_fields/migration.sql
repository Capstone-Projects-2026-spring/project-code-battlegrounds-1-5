/*
  Warnings:

  - You are about to drop the column `timeToPassMs` on the `GameResult` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GameResult" DROP COLUMN "timeToPassMs",
ADD COLUMN     "team1TimeToPassMs" INTEGER,
ADD COLUMN     "team2TimeToPassMs" INTEGER,
ALTER COLUMN "team1Code" DROP NOT NULL;
