-- Add per-team result columns first so existing data can be backfilled.
ALTER TABLE "GameTest"
ADD COLUMN "team1ActualOutput" JSONB,
ADD COLUMN "team1ExecutionTimeMs" INTEGER,
ADD COLUMN "team1Passed" BOOLEAN,
ADD COLUMN "team1Stderr" TEXT,
ADD COLUMN "team2ActualOutput" JSONB,
ADD COLUMN "team2ExecutionTimeMs" INTEGER,
ADD COLUMN "team2Passed" BOOLEAN,
ADD COLUMN "team2Stderr" TEXT;

-- Backfill team-scoped rows from legacy fields.
UPDATE "GameTest"
SET
  "team1ActualOutput" = "actualOutput",
  "team1ExecutionTimeMs" = "executionTimeMs",
  "team1Passed" = "passed",
  "team1Stderr" = "stderr"
WHERE "teamNumber" = 1;

UPDATE "GameTest"
SET
  "team2ActualOutput" = "actualOutput",
  "team2ExecutionTimeMs" = "executionTimeMs",
  "team2Passed" = "passed",
  "team2Stderr" = "stderr"
WHERE "teamNumber" = 2;

-- Consolidate hidden rows into a single shared row (teamNumber = 0).
UPDATE "GameTest" AS t1
SET
  "team2ActualOutput" = t2."actualOutput",
  "team2ExecutionTimeMs" = t2."executionTimeMs",
  "team2Passed" = t2."passed",
  "team2Stderr" = t2."stderr"
FROM "GameTest" AS t2
WHERE t1."type" = 'Hidden'
  AND t2."type" = 'Hidden'
  AND t1."teamNumber" = 1
  AND t2."teamNumber" = 2
  AND t1."gameResultId" = t2."gameResultId"
  AND t1."testCaseId" = t2."testCaseId";

UPDATE "GameTest"
SET "teamNumber" = 0
WHERE "type" = 'Hidden' AND "teamNumber" = 1;

DELETE FROM "GameTest"
WHERE "type" = 'Hidden' AND "teamNumber" = 2;

-- Replace unique constraints with keys that include test type.
DROP INDEX IF EXISTS "GameTest_gameResultId_teamNumber_position_key";
DROP INDEX IF EXISTS "GameTest_gameResultId_teamNumber_testCaseId_key";

CREATE UNIQUE INDEX "GameTest_gameResultId_type_teamNumber_position_key"
  ON "GameTest"("gameResultId", "type", "teamNumber", "position");

CREATE UNIQUE INDEX "GameTest_gameResultId_type_teamNumber_testCaseId_key"
  ON "GameTest"("gameResultId", "type", "teamNumber", "testCaseId");

CREATE INDEX "GameTest_gameResultId_type_idx"
  ON "GameTest"("gameResultId", "type");

-- Remove legacy per-row result fields after backfill.
ALTER TABLE "GameTest"
DROP COLUMN "actualOutput",
DROP COLUMN "executionTimeMs",
DROP COLUMN "passed",
DROP COLUMN "stderr";
