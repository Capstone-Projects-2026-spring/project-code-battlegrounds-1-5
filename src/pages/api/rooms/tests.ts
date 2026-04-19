import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParameterType } from "@/lib/ProblemInputOutput";
import { type TestableCase } from "@/contexts/GameTestCasesContext";

export interface TestCase {
  id: string;
  input: unknown;
  expected: unknown;
  source: "gameplay" | "hidden";
}

interface ExecutionTestCase extends TestCase {
  executorId: number;
}

interface ExecutionSummary {
  results: unknown[];
  passedCount: number;
  executionTimes: (number | null)[];
  averageExecutionTime: number | null;
  errors: (string | null)[];
}

interface ExecutorResultItem {
  id?: unknown;
  actual?: unknown;
  passed?: unknown;
  stderr?: string;
  stdout?: string;
  exit_code?: number;
  execution_time_ms?: number;
}

interface ExecutorResponse {
  results?: ExecutorResultItem[];
}

type ResultValue = Pick<ExecutorResultItem, 'actual' | 'passed' | 'stderr' | 'execution_time_ms'>;
export interface TestsResponse {
  tests: TestCase[];
  gameplayTests: TestCase[];
  hiddenTests: TestCase[];
  team1Results: unknown[];
  team2Results: unknown[];
  gameplayTeam1Results: unknown[];
  gameplayTeam2Results: unknown[];
  hiddenTeam1Results: unknown[];
  hiddenTeam2Results: unknown[];
  team1PassedCount: number;
  team2PassedCount: number;
  totalTests: number;
  team1ExecutionTimes: (number | null)[];
  team2ExecutionTimes: (number | null)[];
  team1AverageExecutionTime: number | null;
  team2AverageExecutionTime: number | null;
  team1Errors: (string | null)[];
  team2Errors: (string | null)[];
}

export interface ErrorResponse {
  message: string;
}

function isExecutorParameter(value: unknown): value is ParameterType {
  if (!value || typeof value !== "object") return false;

  const maybe = value as Partial<ParameterType>;
  return (
    typeof maybe.name === "string" &&
    typeof maybe.type === "string" &&
    (typeof maybe.value === "string" || maybe.value === null)
  );
}

function normalizeParameterArray(value: unknown): ParameterType[] {
  if (Array.isArray(value)) {
    return value.filter(isExecutorParameter);
  }

  if (isExecutorParameter(value)) {
    return [value];
  }

  return [];
}

function normalizeExpectedParameter(value: unknown): ParameterType {
  const normalized = normalizeParameterArray(value);
  if (normalized.length > 0) {
    return normalized[0];
  }

  return {
    name: "result",
    type: "string",
    value: value === null || value === undefined ? null : String(value),
  };
}

function toDisplayResult(expected: unknown, actual: string | null): unknown {
  const expectedArray = normalizeParameterArray(expected);
  if (expectedArray.length === 0) {
    return actual;
  }

  return expectedArray.map((parameter, index) =>
    index === 0 ? { ...parameter, value: actual } : parameter,
  );
}

function emptyExecution(totalTests: number): ExecutionSummary {
  return {
    results: Array.from({ length: totalTests }, () => null),
    passedCount: 0,
    executionTimes: Array.from({ length: totalTests }, () => null),
    averageExecutionTime: null,
    errors: Array.from({ length: totalTests }, () => null),
  };
}

function computeAverageExecutionTime(
  executionTimes: (number | null)[],
): number | null {
  const validTimes = executionTimes.filter(
    (time): time is number => time !== null && typeof time === "number",
  );

  if (validTimes.length === 0) {
    return null;
  }

  return Math.round(
    validTimes.reduce((total, current) => total + current, 0) /
      validTimes.length,
  );
}

async function executeSubmission(
  code: string | null,
  tests: ExecutionTestCase[],
  executorTestCases: TestableCase[],
): Promise<ExecutionSummary> {
  if (!code || executorTestCases.length === 0) {
    return emptyExecution(tests.length);
  }

  const executorUrl =
    process.env.CODE_EXECUTOR_URL ??
    `http://127.0.0.1:${process.env.EXECUTOR_PORT ?? "6969"}/execute`;

  const payload = {
    language: "javascript",
    code: Buffer.from(code, "utf8").toString("base64"),
    testCases: JSON.stringify(executorTestCases),
    runIDs: JSON.stringify(executorTestCases.map((testCase) => testCase.id)),
  };

  const response = await fetch(executorUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Executor request failed with status ${response.status}`);
  }

  const executionData = (await response.json()) as ExecutorResponse;
  const resultsById = new Map<number, ResultValue>();


  for (const result of executionData.results ?? []) {
    if (typeof result.id !== "number") continue;

    resultsById.set(result.id, {
      actual: typeof result.actual === "string" ? result.actual : null,
      passed: result.passed === true,
      stderr: typeof result.stderr === "string" ? result.stderr : null,
      execution_time_ms: typeof result.execution_time_ms === "number" ? result.execution_time_ms : null,
    } as ResultValue);
  }

  const normalizedResults = tests.map((test) => {
    const result = resultsById.get(test.executorId) as ResultValue;
    return toDisplayResult(test.expected, (result?.actual ?? null) as string | null);
  });

  const executionTimes = tests.map((test) => {
    const result = resultsById.get(test.executorId) as ResultValue;
    return result?.execution_time_ms ?? null;
  });

  const errors = tests.map((test) => {
    const result = resultsById.get(test.executorId) as ResultValue;
    return result?.stderr ?? null;
  });

  // Calculate average execution time (only from successful execution times)
  const averageExecutionTime = computeAverageExecutionTime(executionTimes);

  console.log('Execution times:', {
    count: executionTimes.filter((t): t is number => t !== null).length,
    averageExecutionTime,
  });

  const passedCount = tests.reduce((count, test) => {
    const result = resultsById.get(test.executorId) as ResultValue;
    return result?.passed ? count + 1 : count;
  }, 0);

  return {
    results: normalizedResults,
    passedCount,
    executionTimes,
    averageExecutionTime,
    errors,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestsResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { gameId } = req.query;
  if (!gameId || typeof gameId !== "string") {
    return res.status(400).json({ message: "Invalid game ID" });
  }

  try {
    // Get the game room and its problem
    const gameRoom = await prisma.gameRoom.findUnique({
      where: { id: gameId },
      include: {
        problem: {
          select: { slug: true },
        },
        teams: {
          include: {
            players: {
              select: {
                userId: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        gameResult: {
          select: {
            team1Code: true,
            team2Code: true,
            gameTests: {
              select: {
                teamNumber: true,
                position: true,
                testCaseId: true,
                functionInput: true,
                expectedOutput: true,
              },
              orderBy: [
                { teamNumber: "asc" },
                { position: "asc" },
              ],
            },
          },
        },
      },
    });

    if (!gameRoom || !gameRoom.problem) {
      return res.status(404).json({ message: "Game room not found" });
    }

    let userTeamNumber: 1 | 2 = 1;
    for (let i = 0; i < gameRoom.teams.length; i++) {
      const team = gameRoom.teams[i];
      const userIsOnThisTeam = team.players.some(
        (player) => player.userId === session.user.id,
      );

      if (userIsOnThisTeam) {
        userTeamNumber = (i + 1) as 1 | 2;
        break;
      }
    }

    const persistedGameTests = gameRoom.gameResult?.gameTests ?? [];
    const preferredGameTests = persistedGameTests
      .filter((test) => test.teamNumber === userTeamNumber)
      .sort((left, right) => left.position - right.position);

    const fallbackGameTests = persistedGameTests
      .filter((test) => test.teamNumber !== userTeamNumber)
      .sort((left, right) => left.position - right.position);

    const selectedGameTests =
      preferredGameTests.length > 0 ? preferredGameTests : fallbackGameTests;

    const gameplayFormattedTests: TestCase[] = selectedGameTests.map((test) => ({
      id: String(test.testCaseId),
      input: test.functionInput,
      expected: test.expectedOutput,
      source: "gameplay",
    }));

    // Hidden problem fixtures are always evaluated and returned.
    const problemTests = await prisma.problemTest.findMany({
      where: { problemId: gameRoom.problem.slug },
      select: {
        id: true,
        functionInput: true,
        expectedOutput: true,
      },
    });

    const hiddenFormattedTests: TestCase[] = problemTests.map((test) => ({
      id: test.id,
      input: test.functionInput,
      expected: test.expectedOutput,
      source: "hidden",
    }));

    // Build one executor payload so each team is evaluated in a single call.
    const formattedTests: TestCase[] = [
      ...gameplayFormattedTests,
      ...hiddenFormattedTests,
    ];

    const executionTests: ExecutionTestCase[] = formattedTests.map((test, index) => ({
      ...test,
      executorId: index,
    }));

    const executorTestCases: TestableCase[] = executionTests.map((test) => ({
      id: test.executorId,
      functionInput: normalizeParameterArray(test.input),
      expectedOutput: normalizeExpectedParameter(test.expected),
      computedOutput: null,
    }));

    const [
      team1Execution,
      team2Execution,
    ] = await Promise.all([
      executeSubmission(
        gameRoom.gameResult?.team1Code ?? null,
        executionTests,
        executorTestCases,
      ).catch((error: unknown) => {
        console.error("Failed to evaluate team 1 tests", error);
        return emptyExecution(formattedTests.length);
      }),
      executeSubmission(
        gameRoom.gameResult?.team2Code ?? null,
        executionTests,
        executorTestCases,
      ).catch((error: unknown) => {
        console.error("Failed to evaluate team 2 tests", error);
        return emptyExecution(formattedTests.length);
      }),
    ]);

    const gameplayCount = gameplayFormattedTests.length;

    const team1Results = team1Execution.results;
    const team2Results = team2Execution.results;

    const gameplayTeam1Results = team1Results.slice(0, gameplayCount);
    const gameplayTeam2Results = team2Results.slice(0, gameplayCount);
    const hiddenTeam1Results = team1Results.slice(gameplayCount);
    const hiddenTeam2Results = team2Results.slice(gameplayCount);

    const team1ExecutionTimes = team1Execution.executionTimes;
    const team2ExecutionTimes = team2Execution.executionTimes;

    const team1Errors = team1Execution.errors;
    const team2Errors = team2Execution.errors;

    const team1PassedCount = team1Execution.passedCount;
    const team2PassedCount = team2Execution.passedCount;

    let resolvedTeam1AverageExecutionTime = computeAverageExecutionTime(team1ExecutionTimes);
    let resolvedTeam2AverageExecutionTime = computeAverageExecutionTime(team2ExecutionTimes);

    // Save average execution times if not previously saved
    try {
      const currentResult = await prisma.gameResult.findUnique({
        where: { gameRoomId: gameId },
        select: {
          team1TimeToPassMs: true,
          team2TimeToPassMs: true,
        },
      });

      // Build update data for each team independently
      const dataToUpdate: Partial<{ team1TimeToPassMs: number | null; team2TimeToPassMs: number | null }> = {};

      // Team 1
      if (!currentResult || currentResult.team1TimeToPassMs == null) {
        dataToUpdate.team1TimeToPassMs = resolvedTeam1AverageExecutionTime;
      }

      // Team 2
      if (!currentResult || currentResult.team2TimeToPassMs == null) {
        dataToUpdate.team2TimeToPassMs = resolvedTeam2AverageExecutionTime;
      }

      // Only call update if there's something to update
      let savedResult = currentResult;
      if (Object.keys(dataToUpdate).length > 0) {
        savedResult = await prisma.gameResult.update({
          where: { gameRoomId: gameId },
          data: dataToUpdate,
          select: {
            team1TimeToPassMs: true,
            team2TimeToPassMs: true,
          },
        });
      }

      // Return the saved DB values, not the freshly calculated ones when available.
      resolvedTeam1AverageExecutionTime = savedResult?.team1TimeToPassMs ?? null;
      resolvedTeam2AverageExecutionTime = savedResult?.team2TimeToPassMs ?? null;
    } catch (error) {
      console.error("Failed to save execution times", error);
    }

    return res.status(200).json({
      tests: formattedTests,
      gameplayTests: gameplayFormattedTests,
      hiddenTests: hiddenFormattedTests,
      team1Results,
      team2Results,
      gameplayTeam1Results,
      gameplayTeam2Results,
      hiddenTeam1Results,
      hiddenTeam2Results,
      team1PassedCount,
      team2PassedCount,
      totalTests: formattedTests.length,
      team1ExecutionTimes,
      team2ExecutionTimes,
      team1AverageExecutionTime: resolvedTeam1AverageExecutionTime,
      team2AverageExecutionTime: resolvedTeam2AverageExecutionTime,
      team1Errors,
      team2Errors,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return res
        .status(500)
        .json({ message: error.message || "Failed to fetch tests" });
    }

    return res.status(500).json({ message: "Failed to fetch tests" });
  }
}
