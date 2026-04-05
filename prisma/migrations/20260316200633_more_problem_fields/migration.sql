/*
  Warnings:

  - You are about to drop the `Problem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProblemTest" DROP CONSTRAINT "ProblemTest_problemId_fkey";

-- DropForeignKey
ALTER TABLE "game_rooms" DROP CONSTRAINT "game_rooms_problemId_fkey";

-- DropTable
DROP TABLE "Problem";

-- CreateTable
CREATE TABLE "problem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topics" TEXT[],
    "difficulty" "ProblemDifficulty" NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL,
    "totalSubmissions" INTEGER NOT NULL,
    "totalAccepted" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "dislikes" INTEGER NOT NULL,
    "hints" TEXT,

    CONSTRAINT "problem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "problem_title_idx" ON "problem"("title");

-- CreateIndex
CREATE INDEX "problem_slug_idx" ON "problem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "problem_slug_key" ON "problem"("slug");

-- AddForeignKey
ALTER TABLE "game_rooms" ADD CONSTRAINT "game_rooms_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemTest" ADD CONSTRAINT "ProblemTest_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
