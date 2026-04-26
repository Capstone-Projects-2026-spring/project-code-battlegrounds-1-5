import { GameType, Prisma } from '@prisma/client';
import type { Server } from 'socket.io';
import { z } from 'zod';
import { getPrisma } from '../../prisma';
import type { GameService } from '../../game/gameService';
import type { SocketWithState, TestableCase } from '../../types';
import { validate } from '../../utils/validate';
import { deleteVm } from '../../utils/vm/deleteVm';

const prisma = getPrisma();

const parameterPrimitiveSchema = z.enum([
    'string',
    'number',
    'array_string',
    'array_number',
    'array_array_string',
    'array_array_number',
    'boolean',
]);

const parameterSchema = z.object({
    name: z.string(),
    type: parameterPrimitiveSchema,
    value: z.string().nullable(),
    isOutputParameter: z.boolean().default(false).optional(),
});

const testableCaseSchema = z.object({
    id: z.number(),
    functionInput: z.array(parameterSchema),
    expectedOutput: parameterSchema,
    computedOutput: z.string().nullable().optional(),
});

const submitCodeSchema = z.object({
    roomId: z.string(),
    code: z.string().max(10000).optional(),
    type: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER]),
    team: z.enum(['team1', 'team2']).nullable().optional(),
    teamId: z.string().optional(),
    testCases: z.array(testableCaseSchema).optional(),
    runIDs: z.array(z.union([z.string(), z.number()])).optional(),
});

const submitTestCasesSchema = z.object({
    roomId: z.string(),
    code: z.string().max(10000),
    testCases: z.array(testableCaseSchema),
    runIDs: z.array(z.union([z.string(), z.number()])),
});

interface HiddenTestRecord {
    id: string;
    functionInput: Prisma.JsonValue;
    expectedOutput: Prisma.JsonValue;
}

interface ExecutorResultItem {
    id?: number;
    actual?: unknown;
    passed?: boolean;
    stderr?: string | null;
    execution_time_ms?: number | null;
}

interface ExecutorResponse {
    results?: ExecutorResultItem[];
}

interface ExecutionResult {
    teamNumber: 1 | 2;
    totalTests: number;
    passedCount: number;
    executionTimeMs: number[];
    success: true;
}

interface ExecuteAndPersistParams {
    roomId: string;
    gameResultId: string;
    code: string;
    teamNumber: 1 | 2;
    testCases: TestableCase[];
    testCaseIds: Array<string | number>;
    gameRoomId: string;
    hiddenTestCases?: TestableCase[];
    hiddenTestCaseIds?: Array<string | number>;
}

function toJsonInput(value: unknown) {
    if (value === null || value === undefined) {
        return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
}

function normalizeHiddenTests(hiddenTests: HiddenTestRecord[], gameTestCount: number): TestableCase[] {
    return hiddenTests.map((hiddenTest, index) => ({
        id: gameTestCount + index,
        functionInput: Array.isArray(hiddenTest.functionInput)
            ? (hiddenTest.functionInput as unknown as TestableCase['functionInput'])
            : ([hiddenTest.functionInput] as unknown as TestableCase['functionInput']),
        expectedOutput: (Array.isArray(hiddenTest.expectedOutput)
            ? hiddenTest.expectedOutput[0]
            : hiddenTest.expectedOutput) as unknown as TestableCase['expectedOutput'],
    }));
}

function serializeComputedOutput(actual: unknown): string | null {
    if (actual === null || actual === undefined) {
        return null;
    }
    return typeof actual === 'string' ? actual : JSON.stringify(actual);
}

async function executeAndPersist({
    roomId,
    gameResultId,
    code,
    teamNumber,
    testCases,
    testCaseIds,
    gameRoomId,
    hiddenTestCases = [],
    hiddenTestCaseIds = [],
}: ExecuteAndPersistParams): Promise<ExecutionResult> {
    const allTestCases = [...testCases, ...hiddenTestCases];
    const allTestCaseIds = [...testCaseIds, ...hiddenTestCaseIds];
    const gameTestCount = testCases.length;

    const executorPayload = {
        gameId: roomId,
        language: 'javascript',
        code: Buffer.from(code, 'utf8').toString('base64'),
        testCases: JSON.stringify(allTestCases),
        runIDs: JSON.stringify(allTestCases.map((_, index) => index)),
    };

    const executorAddress = process.env.EXECUTOR_ADDR;
    if (!executorAddress) {
        throw new Error('EXECUTOR_ADDR is not configured.');
    }

    let executorResponse: ExecutorResponse;
    try {
        console.log('[EXECUTOR] Payload testCases being sent:', JSON.stringify(allTestCases, null, 2));
        console.log(
            '[EXECUTOR] runIDs being sent:',
            JSON.stringify(allTestCases.map((_, index) => index))
        );

        const res = await fetch(`${executorAddress}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(executorPayload),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[EXECUTOR] Error response:', errorText);
            throw new Error(`Executor request failed with status ${res.status}`);
        }

        executorResponse = (await res.json()) as ExecutorResponse;
        console.log(`[EXECUTION] Team ${teamNumber} execution:`, JSON.stringify(executorResponse, null, 2));
    } catch (error: unknown) {
        console.error(`[EXECUTION] Error calling executor for team ${teamNumber}:`, error);
        const message = error instanceof Error ? error.message : 'Unknown executor error';
        throw new Error(`Executor call failed for team ${teamNumber}: ${message}`);
    }

    const results = Array.isArray(executorResponse.results) ? executorResponse.results : [];
    const gameTestsToCreate: Prisma.GameTestUncheckedCreateInput[] = [];
    const executionTimes: number[] = [];

    for (let position = 0; position < allTestCases.length; position += 1) {
        const result = results[position] ?? {};
        const testCaseId = allTestCaseIds[position];
        const isHidden = position >= gameTestCount;
        const testType = isHidden ? 'Hidden' : 'Game';

        const execTime = result.execution_time_ms ?? 0;
        executionTimes.push(execTime);

        const currentCase = allTestCases[position];
        gameTestsToCreate.push({
            gameResultId,
            gameRoomId,
            testCaseId: String(testCaseId ?? position),
            position,
            teamNumber,
            functionInput: toJsonInput(currentCase?.functionInput),
            expectedOutput: toJsonInput(currentCase?.expectedOutput),
            actualOutput: toJsonInput(result.actual),
            passed: result.passed === true,
            stderr: result.stderr ?? null,
            executionTimeMs: result.execution_time_ms ?? null,
            type: testType,
        });
    }

    try {
        await prisma.$transaction(
            gameTestsToCreate.map((testData) =>
                prisma.gameTest.create({
                    data: testData,
                })
            )
        );
        console.log(
            `[PERSISTENCE] Persisted ${gameTestsToCreate.length} GameTest records for team ${teamNumber}`
        );
    } catch (error: unknown) {
        console.error('[PERSISTENCE] Failed to persist GameTest records:', error);
        const message = error instanceof Error ? error.message : 'Unknown persistence error';
        throw new Error(`Failed to persist test results: ${message}`);
    }

    const passedCount = gameTestsToCreate.filter((testCase) => testCase.passed).length;
    return {
        teamNumber,
        totalTests: gameTestsToCreate.length,
        passedCount,
        executionTimeMs: executionTimes,
        success: true,
    };
}

export function registerExecutionHandlers(
    io: Server,
    socket: SocketWithState,
    gameService: GameService
): void {
    socket.on('submitCode', (data) => {
        void (async (): Promise<void> => {
            const payload = validate(submitCodeSchema, data);
            if (!payload) {
                socket.emit('error', { message: 'Invalid payload for submitCode.' });
                return;
            }

            const {
                roomId,
                code = '',
                type,
                team,
                teamId,
                testCases: payloadTestCases,
                runIDs: payloadRunIds,
            } = payload;

            console.log(`Submitting code for Room ${roomId}`);
            console.log(
                'submitCode received for roomId:',
                roomId,
                'with code length:',
                code.length,
                'and type:',
                type
            );

            if (type === GameType.TWOPLAYER) {
                try {
                    const gameResult = await prisma.gameResult.findUnique({
                        where: { gameRoomId: roomId },
                        select: { id: true },
                    });

                    const gameRoom = await prisma.gameRoom.findUnique({
                        where: { id: roomId },
                        include: {
                            problem: { select: { slug: true } },
                            teams: { select: { id: true } },
                        },
                    });

                    if (!gameResult || !gameRoom) {
                        socket.emit('error', { message: 'Game or result not found' });
                        return;
                    }

                    await prisma.gameResult.update({
                        where: { id: gameResult.id },
                        data: { team1Code: code },
                    });

                    const team1Id = gameRoom.teams[0]?.id;
                    let gameTestCases: TestableCase[] = [];
                    let gameTestCaseIds: Array<string | number> = [];

                    if (team1Id) {
                        const redisTestCases = await gameService.getTestCases(team1Id);
                        if (redisTestCases) {
                            gameTestCases = redisTestCases;
                            gameTestCaseIds = redisTestCases.map((testCase) => testCase.id);
                            console.log(
                                `[TWOPLAYER] Fetched ${gameTestCases.length} game test cases from Redis for team1:`,
                                gameTestCaseIds
                            );
                        }
                    }

                    if (gameTestCases.length === 0) {
                        gameTestCases = payloadTestCases ?? [];
                        gameTestCaseIds = payloadRunIds ?? [];
                        console.log('[TWOPLAYER] No test cases in Redis, using payload test cases');
                    }

                    const hiddenTests = await prisma.problemTest.findMany({
                        where: { problemId: gameRoom.problem.slug },
                        select: { id: true, functionInput: true, expectedOutput: true },
                    });

                    const normalizedHiddenTests = normalizeHiddenTests(hiddenTests, gameTestCases.length);
                    const hiddenTestCaseIds = hiddenTests.map((hiddenTest) => hiddenTest.id);

                    const executionResult = await executeAndPersist({
                        roomId,
                        gameResultId: gameResult.id,
                        code,
                        teamNumber: 1,
                        testCases: gameTestCases,
                        testCaseIds: gameTestCaseIds,
                        gameRoomId: roomId,
                        hiddenTestCases: normalizedHiddenTests,
                        hiddenTestCaseIds,
                    });

                    console.log('[TWOPLAYER] Execution completed:', executionResult);
                    await gameService.cleanupGameTimers(roomId);
                    void deleteVm(roomId);
                    io.to(roomId).emit('gameEnded');
                    return;
                } catch (error: unknown) {
                    console.error('Error in TWOPLAYER execution:', error);
                    socket.emit('error', { message: 'Code execution failed! Try again in a bit...' });
                    return;
                }
            }

            if (type === GameType.FOURPLAYER) {
                if (!team) {
                    socket.emit('error', { message: 'Missing team for four-player submitCode.' });
                    return;
                }

                try {
                    const submissionKey = `game:${roomId}:submissions`;
                    const existingSubmissions =
                        (await gameService.getGameData<Partial<Record<'team1' | 'team2', boolean>>>(
                            submissionKey
                        )) ?? {};

                    if (existingSubmissions[team]) {
                        console.log(`Team ${team} already submitted, ignoring duplicate submission`);
                        return;
                    }

                    const gameResult = await prisma.gameResult.findUnique({
                        where: { gameRoomId: roomId },
                        select: { id: true },
                    });

                    const gameRoom = await prisma.gameRoom.findUnique({
                        where: { id: roomId },
                        include: {
                            problem: { select: { slug: true } },
                            teams: { select: { id: true } },
                        },
                    });

                    if (!gameResult || !gameRoom) {
                        socket.emit('error', { message: 'Game or result not found' });
                        return;
                    }

                    await prisma.gameResult.update({
                        where: { id: gameResult.id },
                        data: team === 'team1' ? { team1Code: code } : { team2Code: code },
                    });
                    console.log(`code submitted for four-player game by ${team}`);

                    const updatedSubmissions: Partial<Record<'team1' | 'team2', boolean>> = {
                        ...existingSubmissions,
                        [team]: true,
                    };
                    await gameService.saveGameData(submissionKey, JSON.stringify(updatedSubmissions));

                    if (Object.keys(updatedSubmissions).length === 2) {
                        console.log('[FOURPLAYER] Both teams submitted, executing both in parallel');

                        try {
                            const latestResult = await prisma.gameResult.findUnique({
                                where: { id: gameResult.id },
                                select: { team1Code: true, team2Code: true },
                            });

                            const team1Id = gameRoom.teams[0]?.id;
                            const team2Id = gameRoom.teams[1]?.id;

                            let team1GameTestCases: TestableCase[] = [];
                            let team1GameTestCaseIds: Array<string | number> = [];
                            let team2GameTestCases: TestableCase[] = [];
                            let team2GameTestCaseIds: Array<string | number> = [];

                            if (team1Id) {
                                const redisTestCases = await gameService.getTestCases(team1Id);
                                if (redisTestCases) {
                                    team1GameTestCases = redisTestCases;
                                    team1GameTestCaseIds = redisTestCases.map((testCase) => testCase.id);
                                    console.log(
                                        `[FOURPLAYER] Fetched ${team1GameTestCases.length} game test cases for team1:`,
                                        team1GameTestCaseIds
                                    );
                                }
                            }

                            if (team2Id) {
                                const redisTestCases = await gameService.getTestCases(team2Id);
                                if (redisTestCases) {
                                    team2GameTestCases = redisTestCases;
                                    team2GameTestCaseIds = redisTestCases.map((testCase) => testCase.id);
                                    console.log(
                                        `[FOURPLAYER] Fetched ${team2GameTestCases.length} game test cases for team2:`,
                                        team2GameTestCaseIds
                                    );
                                }
                            }

                            if (team1GameTestCases.length === 0) {
                                team1GameTestCases = payloadTestCases ?? [];
                                team1GameTestCaseIds = payloadRunIds ?? [];
                                console.log('[FOURPLAYER] No team1 test cases in Redis, using payload');
                            }

                            if (team2GameTestCases.length === 0) {
                                team2GameTestCases = payloadTestCases ?? [];
                                team2GameTestCaseIds = payloadRunIds ?? [];
                                console.log('[FOURPLAYER] No team2 test cases in Redis, using payload');
                            }

                            const hiddenTests = await prisma.problemTest.findMany({
                                where: { problemId: gameRoom.problem.slug },
                                select: { id: true, functionInput: true, expectedOutput: true },
                            });

                            const normalizedHiddenTestsTeam1 = normalizeHiddenTests(hiddenTests, team1GameTestCases.length);
                            const normalizedHiddenTestsTeam2 = normalizeHiddenTests(hiddenTests, team2GameTestCases.length);
                            const hiddenTestCaseIds = hiddenTests.map((hiddenTest) => hiddenTest.id);

                            await Promise.all([
                                executeAndPersist({
                                    roomId,
                                    gameResultId: gameResult.id,
                                    code: latestResult?.team1Code ?? '',
                                    teamNumber: 1,
                                    testCases: team1GameTestCases,
                                    testCaseIds: team1GameTestCaseIds,
                                    gameRoomId: roomId,
                                    hiddenTestCases: normalizedHiddenTestsTeam1,
                                    hiddenTestCaseIds,
                                }).catch((error: unknown) => {
                                    console.error('[FOURPLAYER] Team 1 execution failed:', error);
                                    return null;
                                }),
                                executeAndPersist({
                                    roomId,
                                    gameResultId: gameResult.id,
                                    code: latestResult?.team2Code ?? '',
                                    teamNumber: 2,
                                    testCases: team2GameTestCases,
                                    testCaseIds: team2GameTestCaseIds,
                                    gameRoomId: roomId,
                                    hiddenTestCases: normalizedHiddenTestsTeam2,
                                    hiddenTestCaseIds,
                                }).catch((error: unknown) => {
                                    console.error('[FOURPLAYER] Team 2 execution failed:', error);
                                    return null;
                                }),
                            ]);

                            console.log('[FOURPLAYER] Both executions completed');
                        } catch (error: unknown) {
                            console.error('[FOURPLAYER] Parallel execution failed:', error);
                        }
                    } else {
                        console.log('[FOURPLAYER] First team submitted, waiting for other team');
                        if (teamId) {
                            io.to(teamId).emit('waitingForOtherTeam');
                        }
                    }

                    const submissions = await gameService.getGameData<
                        Partial<Record<'team1' | 'team2', boolean>>
                    >(
                        `game:${roomId}:submissions`
                    );
                    if (submissions && Object.keys(submissions).length === 2) {
                        await gameService.cleanupGameTimers(roomId);
                        await prisma.gameRoom.update({
                            where: { id: roomId },
                            data: { status: 'FINISHED' },
                        });
                        void deleteVm(roomId);
                        await gameService.deleteGameData(`game:${roomId}:submissions`);
                        io.to(roomId).emit('gameEnded');
                    }
                } catch (error: unknown) {
                    console.error('[FOURPLAYER] Error in submission:', error);
                    socket.emit('error', { message: 'Submission failed try again in a bit' });
                }
            }
        })();
    });

    socket.on('submitTestCases', (data) => {
        void (async (): Promise<void> => {
            const payload = validate(submitTestCasesSchema, data);
            if (!payload) {
                socket.emit('error', { message: 'Invalid payload for submitTestCases.' });
                return;
            }

            const { roomId, code, testCases, runIDs } = payload;
            const executorAddress = process.env.EXECUTOR_ADDR;
            if (!executorAddress) {
                socket.emit('error', { message: 'Executor address is not configured.' });
                return;
            }

            console.log(`Submitting test cases for Room ${roomId}`);

            const requestPayload = {
                gameId: roomId,
                language: 'javascript',
                code: Buffer.from(code, 'utf8').toString('base64'),
                testCases: JSON.stringify(testCases),
                runIDs: JSON.stringify(runIDs),
            };

            const res = await fetch(`${executorAddress}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload),
            });
            const json = (await res.json()) as ExecutorResponse;

            console.log(JSON.stringify(json, null, 2));

            const toReceive: TestableCase[] = [];
            const results = Array.isArray(json.results) ? json.results : [];
            for (const result of results) {
                if (typeof result.id !== 'number') {
                    continue;
                }

                const matched = testCases.find((testCase) => testCase.id === result.id);
                if (!matched) {
                    continue;
                }

                toReceive.push({
                    id: matched.id,
                    functionInput: matched.functionInput,
                    expectedOutput: matched.expectedOutput,
                    computedOutput: serializeComputedOutput(result.actual),
                });
            }

            socket.emit('receiveTestCaseSync', toReceive);
        })().catch((error: unknown) => {
            console.error('submitTestCases failed', error);
            socket.emit('error', { message: "Sorry that didn't work try again in a few seconds" });
        });
    });
}