/*
  Warnings:

  - You are about to drop the column `problemDescription` on the `Problem` table. All the data in the column will be lost.
  - Added the required column `description` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dislikes` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `likes` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `successRate` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAccepted` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalSubmissions` to the `Problem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Problem" DROP COLUMN "problemDescription",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "dislikes" INTEGER NOT NULL,
ADD COLUMN     "hints" TEXT,
ADD COLUMN     "likes" INTEGER NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "successRate" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "topics" TEXT[],
ADD COLUMN     "totalAccepted" INTEGER NOT NULL,
ADD COLUMN     "totalSubmissions" INTEGER NOT NULL;
