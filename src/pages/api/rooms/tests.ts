import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParameterType } from "@/lib/ProblemInputOutput";
import { type TestableCase } from "@/components/contexts/GameTestCasesContext";

export interface TestCase {
  id: string;
  input: unknown;
  expected: unknown;
}

interface ExecutionSummary {
  results: unknown[];
  passedCount: number;
}

interface ExecutorResultItem {
  id?: unknown;
  actual?: unknown;
  passed?: unknown;
}

interface ExecutorResponse {
  results?: ExecutorResultItem[];
}

export interface TestsResponse {
  tests: TestCase[];
  team1Results: unknown[];
  team2Results: unknown[];
  team1PassedCount: number;
  team2PassedCount: number;
  totalTests: number;
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
  const resultsById = new Map<number, { actual: string | null; passed: boolean }>();

  for (const result of executionData.results ?? []) {
    if (typeof result.id !== "number") continue;

    resultsById.set(result.id, {
      actual: typeof result.actual === "string" ? result.actual : null,
      passed: result.passed === true,
    });
  }

  const normalizedResults = tests.map((test, index) => {
    const result = resultsById.get(index);
    return toDisplayResult(test.expected, result?.actual ?? null);
  });

  const passedCount = Array.from(resultsById.values()).filter(
    (result) => result.passed,
  ).length;

  return {
    results: normalizedResults,
    passedCount,
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
        gameResult: {
          select: {
            team1Code: true,
            team2Code: true,
          },
        },
      },
    });

    if (!gameRoom || !gameRoom.problem) {
      return res.status(404).json({ message: "Game room not found" });
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

    return res.status(200).json({
      tests: formattedTests,
      team1Results: team1Execution.results,
      team2Results: team2Execution.results,
      team1PassedCount: team1Execution.passedCount,
      team2PassedCount: team2Execution.passedCount,
      totalTests: formattedTests.length,
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
