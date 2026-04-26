-- CreateTable
CREATE TABLE "GameTest" (
    "id" TEXT NOT NULL,
    "gameResultId" TEXT NOT NULL,
    "teamNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "testCaseId" INTEGER NOT NULL,
    "functionInput" JSONB NOT NULL,
    "expectedOutput" JSONB NOT NULL,

    CONSTRAINT "GameTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameTest_gameResultId_idx" ON "GameTest"("gameResultId");

-- CreateIndex
CREATE INDEX "GameTest_gameResultId_teamNumber_idx" ON "GameTest"("gameResultId", "teamNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GameTest_gameResultId_teamNumber_position_key" ON "GameTest"("gameResultId", "teamNumber", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GameTest_gameResultId_teamNumber_testCaseId_key" ON "GameTest"("gameResultId", "teamNumber", "testCaseId");

-- AddForeignKey
ALTER TABLE "GameTest" ADD CONSTRAINT "GameTest_gameResultId_fkey" FOREIGN KEY ("gameResultId") REFERENCES "GameResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
