const { z } = require("zod");
const { GameType } = require("@prisma/client");
const { getPrisma } = require("../../prisma");
const { validate } = require("../../utils/validate");
const { deleteVm } = require("../../utils/vm/deleteVm");

const prisma = getPrisma();

function normalizeHiddenTests(hiddenTests, gameTestCount) {
    return hiddenTests.map((t, idx) => ({
        id: gameTestCount + idx,
        functionInput: Array.isArray(t.functionInput) ? t.functionInput : [t.functionInput],
        expectedOutput: Array.isArray(t.expectedOutput) ? t.expectedOutput[0] : t.expectedOutput
    }));
}

const submitCodeSchema = z.object({
    roomId: z.string(),
    code: z.string().max(10000).optional(),
    type: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER]),
    team: z.enum(["team1", "team2"]).nullable().optional(),
    teamId: z.string().optional(),
    testCases: z.array(z.any()).optional(),
    runIDs: z.array(z.any()).optional(),
    submitTime: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
    submitTimer: z.string().nullable().optional(),
});

function toSubmissionTimestamp(submitTime) {
    if (submitTime instanceof Date && !Number.isNaN(submitTime.getTime())) {
        return submitTime.toISOString();
    }

    if (typeof submitTime === "number" && Number.isFinite(submitTime)) {
        const parsedFromNumber = new Date(submitTime);
        if (!Number.isNaN(parsedFromNumber.getTime())) {
            return parsedFromNumber.toISOString();
        }
    }

    if (typeof submitTime === "string") {
        const parsedFromString = new Date(submitTime);
        if (!Number.isNaN(parsedFromString.getTime())) {
            return parsedFromString.toISOString();
        }
    }

    return new Date().toISOString();
}

/**
 * Executes code against test cases and persists results to database
 *
 * @param {Object} params
 * @param {string} params.roomId - GameRoom ID
 * @param {string} params.gameResultId - GameResult ID
 * @param {string} params.code - Solution code to execute
 * @param {number} params.teamNumber - Team number (1 or 2)
 * @param {Array} params.testCases - Game TestableCase array from executor format
 * @param {Array} params.testCaseIds - Array of game testCaseId strings
 * @param {string} params.gameRoomId - GameRoom ID (for direct reference)
 * @param {Array} params.hiddenTestCases - Hidden TestableCase array (optional)
 * @param {Array} params.hiddenTestCaseIds - Array of hidden testCaseId strings (optional)
 * @returns {Promise<ExecutionResult>}
 */
async function executeAndPersist({
    roomId,
    gameResultId,
    code,
    teamNumber,
    testCases,
    testCaseIds,
    gameRoomId,
    hiddenTestCases = [],
    hiddenTestCaseIds = []
}) {
    // STEP 1: Call executor with combined game + hidden tests
    const allTestCases = [...testCases, ...hiddenTestCases];
    const allTestCaseIds = [...testCaseIds, ...hiddenTestCaseIds];
    const gameTestCount = testCases.length;

    const executorPayload = {
        gameId: roomId,
        language: "javascript",
        code: Buffer.from(code, "utf8").toString("base64"),
        testCases: JSON.stringify(allTestCases),
        runIDs: JSON.stringify(allTestCases.map((_, idx) => idx))
    };

    let executorResponse;
    try {
        console.log('[EXECUTOR] Payload testCases being sent:', JSON.stringify(allTestCases, null, 2));
        console.log('[EXECUTOR] runIDs being sent:', JSON.stringify(allTestCases.map((_, idx) => idx)));
        const res = await fetch(`${process.env.EXECUTOR_ADDR}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(executorPayload),
        });
        if (!res.ok) {
            const errorText = await res.text();
            console.error(`[EXECUTOR] Error response:`, errorText);
            throw new Error(`Executor request failed with status ${res.status}`);
        }
        executorResponse = await res.json();
        console.log(`[EXECUTION] Team ${teamNumber} execution:`, JSON.stringify(executorResponse, null, 2));
    } catch (error) {
        console.error(`[EXECUTION] Error calling executor for team ${teamNumber}:`, error);
        throw new Error(`Executor call failed for team ${teamNumber}: ${error.message}`);
    }

    // STEP 2: Parse executor response
    // Expected format: { results: Array<{ id, actual, passed, stderr, execution_time_ms }> }
    const results = executorResponse.results || [];

    // STEP 3: Create GameTest records to persist (both game and hidden)
    const gameTestsToCreate = [];
    const executionTimes = [];

    for (let position = 0; position < allTestCases.length; position++) {
        const result = results[position] || {};
        const testCaseId = allTestCaseIds[position];
        const isHidden = position >= gameTestCount;
        const testType = isHidden ? "Hidden" : "Game";

        const execTime = result.execution_time_ms || 0;
        executionTimes.push(execTime);

        gameTestsToCreate.push({
            gameResultId,
            gameRoomId,
            testCaseId: String(testCaseId),
            position,
            teamNumber,
            functionInput: allTestCases[position]?.functionInput || null,
            expectedOutput: allTestCases[position]?.expectedOutput || null,
            actualOutput: result.actual ? JSON.stringify(result.actual) : null,
            passed: result.passed === true,
            stderr: result.stderr || null,
            executionTimeMs: result.execution_time_ms || null,
            type: testType
        });
    }

    // STEP 4: Persist to database (create new GameTest records)
    try {
        // Batch create all GameTest records in transaction
        await prisma.$transaction(
            gameTestsToCreate.map(testData =>
                prisma.gameTest.create({
                    data: testData
                })
            )
        );
        console.log(`[PERSISTENCE] Persisted ${gameTestsToCreate.length} GameTest records for team ${teamNumber}`);
    } catch (error) {
        console.error(`[PERSISTENCE] Failed to persist GameTest records:`, error);
        throw new Error(`Failed to persist test results: ${error.message}`);
    }

    // STEP 5: Return execution metadata; average runtime is computed in results API from persisted hidden tests.

    const passedCount = gameTestsToCreate.filter(t => t.passed).length;

    return {
        teamNumber,
        totalTests: gameTestsToCreate.length,
        passedCount,
        executionTimeMs: executionTimes,
        success: true
    };
}

function registerExecutionHandlers(io, socket, gameService) {

    socket.on('submitCode', async (data) => {
        const payload = validate(submitCodeSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for submitCode.' });
            return;
        }
        const { roomId, code, type, team, teamId, testCases, runIDs, submitTime, submitTimer } = payload;
        const submissionTimestamp = toSubmissionTimestamp(submitTime);
        const submissionTimer = typeof submitTimer === "string" && submitTimer.trim() ? submitTimer.trim() : submissionTimestamp;
        console.log(`Submitting code for Room ${roomId}`);

        if (!roomId) return;

        console.log('submitCode received for roomId:', roomId, 'with code length:', code?.length, 'and type:', type, 'at time:', submitTime, 'timer:', submitTimer);

        if (type === GameType.TWOPLAYER) {
            console.log('verify its a twoplayer game');

            try {
                // Fetch GameResult and GameRoom with problem info and teams
                const gameResult = await prisma.gameResult.findUnique({
                    where: { gameRoomId: roomId },
                    select: { id: true }
                });

                const gameRoom = await prisma.gameRoom.findUnique({
                    where: { id: roomId },
                    include: {
                        problem: {
                            select: { slug: true }
                        },
                        teams: {
                            select: { id: true }
                        }
                    }
                });

                if (!gameResult || !gameRoom) {
                    socket.emit('error', { message: 'Game or result not found' });
                    return;
                }

                // Save code to DB
                await prisma.gameResult.update({
                    where: { id: gameResult.id },
                    data: {
                        team1Code: code,
                        team1SubmittedAt: submissionTimer
                    }
                });
                console.log('code submitted for two-player game');

                // Fetch game test cases from Redis (created by players)
                const team1Id = gameRoom.teams[0]?.id;
                let gameTestCases = [];
                let gameTestCaseIds = [];

                if (team1Id) {
                    const redisTestCases = await gameService.getTestCases(team1Id);
                    if (redisTestCases && Array.isArray(redisTestCases)) {
                        gameTestCases = redisTestCases;
                        gameTestCaseIds = redisTestCases.map((t) => t.id);  // Use actual test case IDs, not array indices
                        console.log(`[TWOPLAYER] Fetched ${gameTestCases.length} game test cases from Redis for team1:`, gameTestCaseIds);
                    }
                }

                // If no test cases found in Redis, fall back to payload
                if (gameTestCases.length === 0) {
                    gameTestCases = testCases || [];
                    gameTestCaseIds = runIDs || [];
                    console.log('[TWOPLAYER] No test cases in Redis, using payload test cases');
                }

                // Fetch hidden test cases for the problem (using slug) - ONCE, shared between both teams
                const hiddenTests = await prisma.problemTest.findMany({
                    where: { problemId: gameRoom.problem.slug },
                    select: { id: true, functionInput: true, expectedOutput: true }
                });

                // Normalize hidden test cases to match game test structure
                // For TWOPLAYER: Single shared set (not duplicated per team like FOURPLAYER)
                const normalizedHiddenTests = normalizeHiddenTests(hiddenTests, gameTestCases.length);

                const hiddenTestCaseIds = hiddenTests.map(t => t.id);

                // For TWOPLAYER: Only execute for team 1 (shared team, not duplicated)
                // Execute and persist results (with both game and hidden tests)
                const executionResult = await executeAndPersist({
                    roomId,
                    gameResultId: gameResult.id,
                    code,
                    teamNumber: 1,
                    testCases: gameTestCases,
                    testCaseIds: gameTestCaseIds,
                    gameRoomId: roomId,
                    hiddenTestCases: normalizedHiddenTests,
                    hiddenTestCaseIds
                });
                console.log('[TWOPLAYER] Execution completed:', executionResult);
                await gameService.cleanupGameTimers(roomId);
                deleteVm(roomId);
                io.to(roomId).emit('gameEnded');
            } catch (error) {
                console.error("Error in TWOPLAYER execution:", error);
                socket.emit('error', { message: 'Code execution failed! Try again in a bit...' });
            }
        }
        else if (type === GameType.FOURPLAYER) {
            console.log('verify its a fourplayer game');
            if (!team) {
                socket.emit('error', { message: 'Missing team for four-player submitCode.' });
                return;
            }

            try {
                // Track submissions in Redis
                const submissionKey = `game:${roomId}:submissions`;
                const existingSubmissions = await gameService.getGameData(submissionKey);

                if (existingSubmissions && existingSubmissions[team]) {
                    console.log(`Team ${team} already submitted, ignoring duplicate submission`);
                    return;
                }

                // Fetch GameResult and GameRoom with problem info and teams
                const gameResult = await prisma.gameResult.findUnique({
                    where: { gameRoomId: roomId },
                    select: { id: true, team1Code: true, team2Code: true }
                });

                const gameRoom = await prisma.gameRoom.findUnique({
                    where: { id: roomId },
                    include: {
                        problem: {
                            select: { slug: true }
                        },
                        teams: {
                            select: { id: true }
                        }
                    }
                });

                if (!gameResult || !gameRoom) {
                    socket.emit('error', { message: 'Game or result not found' });
                    return;
                }

                // Store this team's code
                await prisma.gameResult.update({
                    where: { id: gameResult.id },
                    data: {
                        ...(team === "team1"
                            ? { team1Code: code, team1SubmittedAt: submissionTimer }
                            : { team2Code: code, team2SubmittedAt: submissionTimer })
                    }
                });
                console.log(`code submitted for four-player game by ${team}`);

                // Track submission
                const updatedSubmissions = {
                    ...(existingSubmissions || {}),
                    [team]: true
                };
                await gameService.saveGameData(submissionKey, JSON.stringify(updatedSubmissions));

                // Check if both teams have submitted
                if (Object.keys(updatedSubmissions).length === 2) {
                    console.log('[FOURPLAYER] Both teams submitted, executing both in parallel');

                    try {
                        // Get the latest codes for both teams
                        const latestResult = await prisma.gameResult.findUnique({
                            where: { id: gameResult.id },
                            select: { team1Code: true, team2Code: true }
                        });

                        // Fetch game test cases from Redis for both teams
                        const team1Id = gameRoom.teams[0]?.id;
                        const team2Id = gameRoom.teams[1]?.id;

                        let team1GameTestCases = [];
                        let team1GameTestCaseIds = [];
                        let team2GameTestCases = [];
                        let team2GameTestCaseIds = [];

                        if (team1Id) {
                            const redisTestCases = await gameService.getTestCases(team1Id);
                            if (redisTestCases && Array.isArray(redisTestCases)) {
                                team1GameTestCases = redisTestCases;
                                team1GameTestCaseIds = redisTestCases.map((t) => t.id);  // Use actual test case IDs
                                console.log(`[FOURPLAYER] Fetched ${team1GameTestCases.length} game test cases for team1:`, team1GameTestCaseIds);
                            }
                        }

                        if (team2Id) {
                            const redisTestCases = await gameService.getTestCases(team2Id);
                            if (redisTestCases && Array.isArray(redisTestCases)) {
                                team2GameTestCases = redisTestCases;
                                team2GameTestCaseIds = redisTestCases.map((t) => t.id);  // Use actual test case IDs
                                console.log(`[FOURPLAYER] Fetched ${team2GameTestCases.length} game test cases for team2:`, team2GameTestCaseIds);
                            }
                        }

                        // Fall back to payload if no Redis test cases found
                        if (team1GameTestCases.length === 0) {
                            team1GameTestCases = testCases || [];
                            team1GameTestCaseIds = runIDs || [];
                            console.log('[FOURPLAYER] No team1 test cases in Redis, using payload');
                        }

                        if (team2GameTestCases.length === 0) {
                            team2GameTestCases = testCases || [];
                            team2GameTestCaseIds = runIDs || [];
                            console.log('[FOURPLAYER] No team2 test cases in Redis, using payload');
                        }

                        // Fetch hidden test cases once (using problem slug)
                        const hiddenTests = await prisma.problemTest.findMany({
                            where: { problemId: gameRoom.problem.slug },
                            select: { id: true, functionInput: true, expectedOutput: true }
                        });

                        // Create normalized hidden tests for each team (they get separate sets)
                        const normalizedHiddenTestsTeam1 = normalizeHiddenTests(hiddenTests, team1GameTestCases.length);

                        const normalizedHiddenTestsTeam2 = normalizeHiddenTests(hiddenTests, team2GameTestCases.length);

                        const hiddenTestCaseIds = hiddenTests.map(t => t.id);

                        // Execute BOTH teams in parallel
                        await Promise.all([
                            executeAndPersist({
                                roomId,
                                gameResultId: gameResult.id,
                                code: latestResult?.team1Code || '',
                                teamNumber: 1,
                                testCases: team1GameTestCases,
                                testCaseIds: team1GameTestCaseIds,
                                gameRoomId: roomId,
                                hiddenTestCases: normalizedHiddenTestsTeam1,
                                hiddenTestCaseIds
                            }).catch(error => {
                                console.error('[FOURPLAYER] Team 1 execution failed:', error);
                                return { success: false, error };
                            }),
                            executeAndPersist({
                                roomId,
                                gameResultId: gameResult.id,
                                code: latestResult?.team2Code || '',
                                teamNumber: 2,
                                testCases: team2GameTestCases,
                                testCaseIds: team2GameTestCaseIds,
                                gameRoomId: roomId,
                                hiddenTestCases: normalizedHiddenTestsTeam2,
                                hiddenTestCaseIds
                            }).catch(error => {
                                console.error('[FOURPLAYER] Team 2 execution failed:', error);
                                return { success: false, error };
                            })
                        ]);

                        console.log('[FOURPLAYER] Both executions completed');
                    } catch (error) {
                        console.error('[FOURPLAYER] Parallel execution failed:', error);
                    }
                } else {
                    // First team submitted - notify waiting
                    console.log('[FOURPLAYER] First team submitted, waiting for other team');
                    if (teamId) {
                        io.to(teamId).emit('waitingForOtherTeam');
                    }
                }
                // Cleanup happens after both teams submit or on error
                if (Object.keys(await gameService.getGameData(`game:${roomId}:submissions`) || {}).length === 2) {
                    await gameService.cleanupGameTimers(roomId);
                    await prisma.gameRoom.update({
                        where: { id: roomId },
                        data: { status: 'FINISHED' }
                    });
                    deleteVm(roomId);
                    await gameService.deleteGameData(`game:${roomId}:submissions`);
                    io.to(roomId).emit('gameEnded');
                }
            } catch (error) {
                console.error('[FOURPLAYER] Error in submission:', error);
                socket.emit('error', { message: 'Submission failed try again in a bit' });
            }
        }
    });

    /**
     * data: object
     * data.gameId: string,
     * data.teamId: string,
     * data.code: string,
     * data.testCases: Array<TestableCase>
     * data.runIDs: Array<number> test case IDs to run
     * 
     * @see GameTestCasesContext#TestableCase
     */
    socket.on("submitTestCases", async (data) => {
        const {
            roomId,
            code,
            testCases,
            runIDs
        } = data;
        console.log(`Submitting test cases for Room ${roomId}`);
        let payload = {
            gameId: roomId,
            language: "javascript",
            code: btoa(code),
            testCases: JSON.stringify(testCases),
            runIDs: JSON.stringify(runIDs)
        };
        // console.log(JSON.stringify(payload));

        try {
            const res = await fetch(`${process.env.EXECUTOR_ADDR}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            // json.testCases should realistically only modify a single property
            // on the existing testCases object: `computedOutput`. Syncing this
            // back to the frontend is handled over there :)
            console.log(JSON.stringify(json, null, 2));

            /* 
              export interface TestableCase {
                id: number;
                functionInput: ParameterType[];
                expectedOutput: ParameterType;
                computedOutput?: string | null;
              }
            */

            const toReceive = [];
            for (const result of json.results) {
                const matched = testCases.find(t => t.id === result.id);
                if (!matched) continue;
                toReceive.push({
                    id: matched.id,
                    functionInput: matched.functionInput,
                    expectedOutput: matched.expectedOutput,
                    computedOutput: result.actual
                });
            }

            socket.emit("receiveTestCaseSync", toReceive);
        } catch (error) {
            console.error(error);
            socket.emit("error", { message: "Sorry that didn't work try again in a few seconds" });
        }
    });
}

module.exports = { registerExecutionHandlers };