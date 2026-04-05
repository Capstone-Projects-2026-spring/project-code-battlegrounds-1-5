/*
  Warnings:

  - You are about to drop the column `testCode` on the `ProblemTest` table. All the data in the column will be lost.
  - Added the required column `expectedOutput` to the `ProblemTest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `functionInput` to the `ProblemTest` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ProblemTest" DROP CONSTRAINT "ProblemTest_problemId_fkey";

-- AlterTable
ALTER TABLE "ProblemTest" DROP COLUMN "testCode",
ADD COLUMN     "expectedOutput" JSONB NOT NULL,
ADD COLUMN     "functionInput" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "problem" ADD COLUMN     "starterCode" TEXT;

-- AddForeignKey
ALTER TABLE "ProblemTest" ADD CONSTRAINT "ProblemTest_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problem"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
