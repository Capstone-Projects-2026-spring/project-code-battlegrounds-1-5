import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateScorePair } from "@/util/scoring";

export interface TestCase {
  id: string;
  input: unknown;
  expected: unknown;
}

export interface TeamGameMadeTestCase {
  id: string;
  input: unknown;
  expected: unknown;
  actual: unknown;
  error: string | null;
  passed: boolean;
}


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
  team1TotalTests: number;
  team2TotalTests: number;
  team1AverageExecutionTime: number | null;
  team2AverageExecutionTime: number | null;
  team1Errors: (string | null)[];
  team2Errors: (string | null)[];
  team1GameMadeTests: TeamGameMadeTestCase[];
  team2GameMadeTests: TeamGameMadeTestCase[];

  // Submission & Time Metrics
  team1TimeLeftSeconds: number | null;
  team2TimeLeftSeconds: number | null;
}

export interface ErrorResponse {
  message: string;
}

function parseOutput(output: unknown): unknown {
  if (!output) return null;
  try {
    return JSON.parse(
      typeof output === "string" ? output : JSON.stringify(output)
    );
  } catch {
    return output;
  }
}

function normalizeExpected(output: unknown): unknown[] {
  const parsed = parseOutput(output);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return [parsed];
  return [];
}

function parseTimerDisplay(submittedAt: string | null | undefined): number | null {
  if (!submittedAt) return null;

  const match = submittedAt.trim().match(/^(\d+):([0-5]?\d)$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;

  return minutes * 60 + seconds;
}

function calculateTimeLeftSeconds(submittedAt: string | null | undefined): number | null {
  const remainingSeconds = parseTimerDisplay(submittedAt);
  return remainingSeconds === null ? null : Math.max(0, remainingSeconds);
}

function mapTeamGameMadeTestCase(gameTest: {
  id: string;
  functionInput: unknown;
  expectedOutput: unknown;
  actualOutput: unknown;
  stderr: string | null;
  passed: boolean | null;
}): TeamGameMadeTestCase {
  return {
    id: gameTest.id,
    input: gameTest.functionInput,
    expected: normalizeExpected(gameTest.expectedOutput),
    actual: parseOutput(gameTest.actualOutput),
    error: gameTest.stderr ?? null,
    passed: Boolean(gameTest.passed),
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
          },
        },
        gameResult: {
          select: {
            id: true,
            winningTeamId: true,
            team1Code: true,
            team2Code: true,
            team1SubmittedAt: true,
            team2SubmittedAt: true,
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

    // QUERY GameTest records from database (no re-execution needed)
    const gameTestResults = await prisma.gameTest.findMany({
      where: {
        gameResultId: gameRoom.gameResult?.id,
      },
      orderBy: [{ teamNumber: "asc" }, { position: "asc" }],
    });

    // Group by team
    const team1GameTests = gameTestResults.filter((gt) => gt.teamNumber === 1);
    const team2GameTests = gameTestResults.filter((gt) => gt.teamNumber === 2);

    // Build a map of tests grouped by input for unified display
    // For each position, we want to show the input once with both teams' outputs
    const testsByPosition = new Map<number, { team1: typeof team1GameTests[0] | undefined; team2: typeof team2GameTests[0] | undefined }>();

    const ensureTestPosition = (position: number) => {
      if (!testsByPosition.has(position)) {
        testsByPosition.set(position, { team1: undefined, team2: undefined });
      }
    };

    team1GameTests.forEach((gt) => {
      ensureTestPosition(gt.position);
      testsByPosition.get(gt.position)!.team1 = gt;
    });

    team2GameTests.forEach((gt) => {
      ensureTestPosition(gt.position);
      testsByPosition.get(gt.position)!.team2 = gt;
    });

    // Create unified hidden test cases with both team results (these are grading/scoring tests)
    const sortedPositions = Array.from(testsByPosition.keys())
      .filter(position => {
        const pair = testsByPosition.get(position)!;
        return (pair.team1?.type === "Hidden") || (pair.team2?.type === "Hidden");
      })
      .sort((a, b) => a - b);
    const hiddenScoringCases = sortedPositions.map((position) => {
      const testPair = testsByPosition.get(position)!;
      const team1Test = testPair.team1;
      const team2Test = testPair.team2;

      return {
        testCase: {
          id: team1Test?.id || team2Test?.id || `test-${position}`,
          input: team1Test?.functionInput ?? team2Test?.functionInput,
          expected: normalizeExpected(team1Test?.expectedOutput ?? team2Test?.expectedOutput),
        } as TestCase,
        team1Actual: team1Test ? parseOutput(team1Test.actualOutput) : undefined,
        team2Actual: team2Test ? parseOutput(team2Test.actualOutput) : undefined,
        team1Error: team1Test?.stderr ?? null,
        team2Error: team2Test?.stderr ?? null,
      };
    });

    const unifiedTestCases: TestCase[] = hiddenScoringCases.map((caseData) => caseData.testCase);

    // Game-made tests are shown separately from hidden scoring tests.
    const team1GameMadeTests = team1GameTests
      .filter((gt) => gt.type === "Game")
      .sort((a, b) => a.position - b.position)
      .map((gt) => mapTeamGameMadeTestCase(gt));

    const team2GameMadeTests = team2GameTests
      .filter((gt) => gt.type === "Game")
      .sort((a, b) => a.position - b.position)
      .map((gt) => mapTeamGameMadeTestCase(gt));

    // Calculate average execution times from GameTest records (only hidden tests)
    const calculateAverageTime = (
      gameTests: (typeof gameTestResults)[number][]
    ) => {
      // Only include hidden test cases for average calculation
      const hiddenTests = gameTests.filter((gt) => gt.type === "Hidden");
      const validTimes = hiddenTests
        .map((gt) => gt.executionTimeMs)
        .filter((t): t is number => t !== null && typeof t === "number" && t > 0);

      if (validTimes.length === 0) return null;
      return Math.round(
        validTimes.reduce((a, b) => a + b, 0) / validTimes.length
      );
    };

    const team1AverageExecutionTime = calculateAverageTime(team1GameTests);
    const team2AverageExecutionTime = calculateAverageTime(team2GameTests);

    const team1ActualOutputs = hiddenScoringCases.map((caseData) => caseData.team1Actual);
    const team2ActualOutputs = hiddenScoringCases.map((caseData) => caseData.team2Actual);
    const team1ErrorsArray = hiddenScoringCases.map((caseData) => caseData.team1Error);
    const team2ErrorsArray = hiddenScoringCases.map((caseData) => caseData.team2Error);

    const team1PassedCount = team1GameTests.filter((gt) => gt.type === "Hidden" && gt.passed).length;
    const team2PassedCount = team2GameTests.filter((gt) => gt.type === "Hidden" && gt.passed).length;
    const team1TotalTests = team1GameTests.filter((gt) => gt.type === "Hidden").length;
    const team2TotalTests = team2GameTests.filter((gt) => gt.type === "Hidden").length;
    const scoringTotalTests = Math.max(team1TotalTests, team2TotalTests);
    const team1SubmittedAt: string | null = gameRoom.gameResult?.team1SubmittedAt ?? null;
    const team2SubmittedAt: string | null = gameRoom.gameResult?.team2SubmittedAt ?? null;
    const team1TimeLeftSeconds = calculateTimeLeftSeconds(team1SubmittedAt);
    const team2TimeLeftSeconds = calculateTimeLeftSeconds(team2SubmittedAt);
    const team1Id = gameRoom.teams[0]?.id ?? null;
    const team2Id = gameRoom.teams[1]?.id ?? null;

    let nextWinningTeamId: string | null = null;
    if (gameRoom.gameType === "TWOPLAYER") {
      nextWinningTeamId = team1Id;
    } else if (team1Id && team2Id) {
      const [team1Score, team2Score] = calculateScorePair(
        team1PassedCount,
        team2PassedCount,
        scoringTotalTests,
        team1AverageExecutionTime,
        team2AverageExecutionTime,
        team1TimeLeftSeconds,
        team2TimeLeftSeconds,
        "Team 1",
        "Team 2"
      );

      nextWinningTeamId =
        team1Score === team2Score ? null : (team1Score > team2Score ? team1Id : team2Id);
    }

    const currentWinningTeamId = gameRoom.gameResult?.winningTeamId ?? null;
    if (gameRoom.gameResult?.id && currentWinningTeamId !== nextWinningTeamId) {
      await prisma.gameResult.update({
        where: { id: gameRoom.gameResult.id },
        data: { winningTeamId: nextWinningTeamId },
      });
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
      tests: unifiedTestCases,
      team1Results: team1ActualOutputs,
      team2Results: team2ActualOutputs,
      team1PassedCount,
      team2PassedCount,
      totalTests: unifiedTestCases.length,
      team1TotalTests,
      team2TotalTests,
      team1AverageExecutionTime,
      team2AverageExecutionTime,
      team1Errors: team1ErrorsArray,
      team2Errors: team2ErrorsArray,
      team1GameMadeTests,
      team2GameMadeTests,

      // Submission & Time Metrics
      team1TimeLeftSeconds,
      team2TimeLeftSeconds,
    });
  } catch (error: unknown) {
    console.error("[RESULTS API] Error:", error);
    if (error instanceof Error) {
      return res.status(500).json({
        message: error.message || "Failed to fetch tests",
      });
    }
    return res.status(500).json({ message: "Failed to fetch tests" });
  }
}
