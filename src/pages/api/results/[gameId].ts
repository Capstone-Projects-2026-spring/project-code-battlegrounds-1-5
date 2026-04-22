import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParameterType } from "@/lib/ProblemInputOutput";
import { type TestableCase } from "@/contexts/GameTestCasesContext";

export interface TestCase {
  id: string;
  input: unknown;
  expected: unknown;
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
  // Problem & Game Details
  problem: {
    id: string;
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topics: string[];
  };
  gameType: string;
  userTeamNumber: 1 | 2;
  team1Code: string | null;
  team2Code: string | null;

  // Test Execution Results
  tests: TestCase[];
  team1Results: unknown[];
  team2Results: unknown[];
  team1PassedCount: number;
  team2PassedCount: number;
  totalTests: number;
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

async function executeSubmission(
  code: string | null,
  tests: TestCase[],
  executorTestCases: TestableCase[],
): Promise<ExecutionSummary> {
  if (!code || executorTestCases.length === 0) {
    return emptyExecution(tests.length);
  }

  const executorUrl = `${process.env.EXECUTOR_ADDR}/execute`;

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
  console.log("[EXECUTOR RESPONSE]", JSON.stringify(executionData, null, 2));
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

  const normalizedResults = tests.map((test, index) => {
    const result = resultsById.get(index) as ResultValue;
    return toDisplayResult(test.expected, (result?.actual ?? null) as string | null);
  });

  const executionTimes = tests.map((_, index) => {
    const result = resultsById.get(index) as ResultValue;
    return result?.execution_time_ms ?? null;
  });

  const errors = tests.map((_, index) => {
    const result = resultsById.get(index) as ResultValue;
    return result?.stderr ?? null;
  });

  // Calculate average execution time (only from successful execution times)
  const validTimes = executionTimes.filter((t): t is number => t !== null && typeof t === "number");
  const averageExecutionTime = validTimes.length > 0
    ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
    : null;

  console.log('Execution times:', {
    validTimes,
    count: validTimes.length,
    averageExecutionTime,
  });

  const passedCount = Array.from(resultsById.values()).filter(
    (result) => result.passed,
  ).length;

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
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            topics: true,
            slug: true,
          },
        },
        gameResult: {
          select: {
            team1Code: true,
            team2Code: true,
          },
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
      },
    });

    if (!gameRoom || !gameRoom.problem) {
      return res.status(404).json({ message: "Game room not found" });
    }

    // Determine which team the current user is on (1 or 2 based on creation order)
    let userTeamNumber: 1 | 2 = 1;
    for (let i = 0; i < gameRoom.teams.length; i++) {
      const team = gameRoom.teams[i];
      const userIsOnThisTeam = team.players.some(
        (p) => p.userId === session.user.id
      );
      if (userIsOnThisTeam) {
        userTeamNumber = (i + 1) as 1 | 2;
        break;
      }
    }

    // Fetch test cases for the problem using slug
    const tests = await prisma.problemTest.findMany({
      where: { problemId: gameRoom.problem.slug },
      select: {
        id: true,
        functionInput: true,
        expectedOutput: true,
      },
    });

    const formattedTests: TestCase[] = tests.map((test) => ({
      id: test.id,
      input: test.functionInput,
      expected: test.expectedOutput,
    }));

    const executorTestCases: TestableCase[] = tests.map((test, index) => ({
      id: index,
      functionInput: normalizeParameterArray(test.functionInput),
      expectedOutput: normalizeExpectedParameter(test.expectedOutput),
      computedOutput: null,
    }));

    const [team1Execution, team2Execution] = await Promise.all([
      executeSubmission(
        gameRoom.gameResult?.team1Code ?? null,
        formattedTests,
        executorTestCases,
      ).catch((error: unknown) => {
        console.error("Failed to evaluate team 1 submission", error);
        return emptyExecution(formattedTests.length);
      }),
      executeSubmission(
        gameRoom.gameResult?.team2Code ?? null,
        formattedTests,
        executorTestCases,
      ).catch((error: unknown) => {
        console.error("Failed to evaluate team 2 submission", error);
        return emptyExecution(formattedTests.length);
      }),
    ]);

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
        dataToUpdate.team1TimeToPassMs = team1Execution.averageExecutionTime;
      }

      // Team 2
      if (!currentResult || currentResult.team2TimeToPassMs == null) {
        dataToUpdate.team2TimeToPassMs = team2Execution.averageExecutionTime;
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

      // Return the saved DB values, not the newly calculated ones
      team1Execution.averageExecutionTime = savedResult?.team1TimeToPassMs ?? null;
      team2Execution.averageExecutionTime = savedResult?.team2TimeToPassMs ?? null;
    } catch (error) {
      console.error("Failed to save execution times", error);
    }

    return res.status(200).json({
      // Problem & Game Details
      problem: {
        id: gameRoom.problem.id,
        title: gameRoom.problem.title,
        description: gameRoom.problem.description,
        difficulty: gameRoom.problem.difficulty,
        topics: gameRoom.problem.topics,
      },
      gameType: gameRoom.gameType,
      userTeamNumber,
      team1Code: gameRoom.gameResult?.team1Code ?? null,
      team2Code: gameRoom.gameResult?.team2Code ?? null,

      // Test Execution Results
      tests: formattedTests,
      team1Results: team1Execution.results,
      team2Results: team2Execution.results,
      team1PassedCount: team1Execution.passedCount,
      team2PassedCount: team2Execution.passedCount,
      totalTests: formattedTests.length,
      team1AverageExecutionTime: team1Execution.averageExecutionTime,
      team2AverageExecutionTime: team2Execution.averageExecutionTime,
      team1Errors: team1Execution.errors,
      team2Errors: team2Execution.errors,
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
