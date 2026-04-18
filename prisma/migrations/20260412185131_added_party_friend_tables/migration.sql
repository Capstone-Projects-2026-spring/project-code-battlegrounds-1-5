/*
  Warnings:

  - You are about to drop the `Party` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PartyMember` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[friendCode]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - The required column `friendCode` was added to the `user` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- DropForeignKey
ALTER TABLE "PartyMember" DROP CONSTRAINT "PartyMember_partyId_fkey";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "friendCode" TEXT NOT NULL;

-- DropTable
DROP TABLE "Party";

-- DropTable
DROP TABLE "PartyMember";

-- CreateTable
CREATE TABLE "friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_member" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "friendship_requesterId_idx" ON "friendship"("requesterId");

-- CreateIndex
CREATE INDEX "friendship_addresseeId_idx" ON "friendship"("addresseeId");

-- CreateIndex
CREATE UNIQUE INDEX "friendship_requesterId_addresseeId_key" ON "friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE UNIQUE INDEX "party_ownerId_key" ON "party"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "party_member_partyId_key" ON "party_member"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "party_member_userId_key" ON "party_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_friendCode_key" ON "user"("friendCode");

-- AddForeignKey
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party" ADD CONSTRAINT "party_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_member" ADD CONSTRAINT "party_member_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_member" ADD CONSTRAINT "party_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
