/*
  Warnings:

  - Added the required column `role` to the `TeamPlayer` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CODER', 'TESTER');

-- AlterTable
ALTER TABLE "TeamPlayer" ADD COLUMN     "role" "Role" NOT NULL;
