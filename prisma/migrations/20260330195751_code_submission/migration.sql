/*
  Warnings:

  - You are about to drop the column `bestCode` on the `GameResult` table. All the data in the column will be lost.
  - Added the required column `team1Code` to the `GameResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `team2Code` to the `GameResult` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameResult" DROP COLUMN "bestCode",
ADD COLUMN     "team1Code" TEXT NOT NULL,
ADD COLUMN     "team2Code" TEXT;
