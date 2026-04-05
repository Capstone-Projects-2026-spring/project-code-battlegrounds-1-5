/*
  Warnings:

  - Added the required column `gameType` to the `game_rooms` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('TWOPLAYER', 'FOURPLAYER');

-- AlterTable
ALTER TABLE "game_rooms" ADD COLUMN     "gameType" "GameType" NOT NULL;
