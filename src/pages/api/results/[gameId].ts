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

  team1TimeLeftSeconds: number | null;
  team2TimeLeftSeconds: number | null;
}

export interface ErrorResponse {
  message: string;
}

type MixedGameTestRow = {
  id: string;
  type: string;
  position: number;
  teamNumber: number;
  functionInput: unknown;
  expectedOutput: unknown;
  actualOutput?: unknown;
  passed?: boolean | null;
  stderr?: string | null;
  executionTimeMs?: number | null;
  team1ActualOutput?: unknown;
  team2ActualOutput?: unknown;
  team1Stderr?: string | null;
  team2Stderr?: string | null;
  team1ExecutionTimeMs?: number | null;
  team2ExecutionTimeMs?: number | null;
  team1Passed?: boolean | null;
  team2Passed?: boolean | null;
};

type HiddenScoringCase = {
  testCase: TestCase;
  team1Actual: unknown;
  team2Actual: unknown;
  team1Error: string | null;
  team2Error: string | null;
  team1Passed: boolean;
  team2Passed: boolean;
  team1ExecutionTimeMs: number | null;
  team2ExecutionTimeMs: number | null;
};

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

function readTeamActual(row: MixedGameTestRow, teamNumber: 1 | 2): unknown {
  if (teamNumber === 1) {
    if (row.team1ActualOutput !== undefined) {
      return parseOutput(row.team1ActualOutput);
    }
    if (row.teamNumber === 1) {
      return parseOutput(row.actualOutput);
    }
    return null;
  }

  if (row.team2ActualOutput !== undefined) {
    return parseOutput(row.team2ActualOutput);
  }
  if (row.teamNumber === 2) {
    return parseOutput(row.actualOutput);
  }
  return null;
}

function readTeamError(row: MixedGameTestRow, teamNumber: 1 | 2): string | null {
  if (teamNumber === 1) {
    if (row.team1Stderr !== undefined) return row.team1Stderr ?? null;
    if (row.teamNumber === 1) return row.stderr ?? null;
    return null;
  }

  if (row.team2Stderr !== undefined) return row.team2Stderr ?? null;
  if (row.teamNumber === 2) return row.stderr ?? null;
  return null;
}

function readTeamPassed(row: MixedGameTestRow, teamNumber: 1 | 2): boolean {
  if (teamNumber === 1) {
    if (row.team1Passed !== undefined) return row.team1Passed === true;
    if (row.teamNumber === 1) return row.passed === true;
    return false;
  }

  if (row.team2Passed !== undefined) return row.team2Passed === true;
  if (row.teamNumber === 2) return row.passed === true;
  return false;
}

function readTeamExecutionTime(row: MixedGameTestRow, teamNumber: 1 | 2): number | null {
  if (teamNumber === 1) {
    if (row.team1ExecutionTimeMs !== undefined) return row.team1ExecutionTimeMs ?? null;
    if (row.teamNumber === 1) return row.executionTimeMs ?? null;
    return null;
  }

  if (row.team2ExecutionTimeMs !== undefined) return row.team2ExecutionTimeMs ?? null;
  if (row.teamNumber === 2) return row.executionTimeMs ?? null;
  return null;
}

function mapTeamGameMadeTestCase(gameTest: MixedGameTestRow, teamNumber: 1 | 2): TeamGameMadeTestCase {
  return {
    id: gameTest.id,
    input: gameTest.functionInput,
    expected: normalizeExpected(gameTest.expectedOutput),
    actual: readTeamActual(gameTest, teamNumber),
    error: readTeamError(gameTest, teamNumber),
    passed: readTeamPassed(gameTest, teamNumber),
  };
}

function calculateAverageTime(times: Array<number | null>): number | null {
  const validTimes = times.filter(
    (t): t is number => t !== null && typeof t === "number" && t > 0
  );

  if (validTimes.length === 0) return null;
  return Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length);
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
              select: { userId: true },
            },
          },
          orderBy: { createdAt: "asc" },
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
        (p) => p.userId === session.user.id
      );
      if (userIsOnThisTeam) {
        userTeamNumber = (i + 1) as 1 | 2;
        break;
      }
    }

    const gameResultId = gameRoom.gameResult?.id;
    const gameTestResults = gameResultId
      ? ((await prisma.gameTest.findMany({
          where: { gameResultId },
          orderBy: [{ teamNumber: "asc" }, { position: "asc" }],
        })) as unknown as MixedGameTestRow[])
      : [];

    const sharedHiddenTests = gameTestResults
      .filter((gt) => gt.type === "Hidden" && gt.teamNumber === 0)
      .sort((a, b) => a.position - b.position);

    let hiddenScoringCases: HiddenScoringCase[] = [];

    if (sharedHiddenTests.length > 0) {
      hiddenScoringCases = sharedHiddenTests.map((row, index) => ({
        testCase: {
          id: row.id || `hidden-${index}`,
          input: row.functionInput,
          expected: normalizeExpected(row.expectedOutput),
        },
        team1Actual: readTeamActual(row, 1),
        team2Actual: readTeamActual(row, 2),
        team1Error: readTeamError(row, 1),
        team2Error: readTeamError(row, 2),
        team1Passed: readTeamPassed(row, 1),
        team2Passed: readTeamPassed(row, 2),
        team1ExecutionTimeMs: readTeamExecutionTime(row, 1),
        team2ExecutionTimeMs: readTeamExecutionTime(row, 2),
      }));
    } else {
      const hiddenTeam1 = gameTestResults
        .filter((gt) => gt.type === "Hidden" && gt.teamNumber === 1)
        .sort((a, b) => a.position - b.position);
      const hiddenTeam2 = gameTestResults
        .filter((gt) => gt.type === "Hidden" && gt.teamNumber === 2)
        .sort((a, b) => a.position - b.position);

      const hiddenByPosition = new Map<number, { team1?: MixedGameTestRow; team2?: MixedGameTestRow }>();

      hiddenTeam1.forEach((row) => {
        const existing = hiddenByPosition.get(row.position) || {};
        existing.team1 = row;
        hiddenByPosition.set(row.position, existing);
      });

      hiddenTeam2.forEach((row) => {
        const existing = hiddenByPosition.get(row.position) || {};
        existing.team2 = row;
        hiddenByPosition.set(row.position, existing);
      });

      hiddenScoringCases = Array.from(hiddenByPosition.entries())
        .sort(([a], [b]) => a - b)
        .map(([position, pair]) => ({
          testCase: {
            id: pair.team1?.id || pair.team2?.id || `hidden-${position}`,
            input: pair.team1?.functionInput ?? pair.team2?.functionInput,
            expected: normalizeExpected(pair.team1?.expectedOutput ?? pair.team2?.expectedOutput),
          },
          team1Actual: pair.team1 ? readTeamActual(pair.team1, 1) : null,
          team2Actual: pair.team2 ? readTeamActual(pair.team2, 2) : null,
          team1Error: pair.team1 ? readTeamError(pair.team1, 1) : null,
          team2Error: pair.team2 ? readTeamError(pair.team2, 2) : null,
          team1Passed: pair.team1 ? readTeamPassed(pair.team1, 1) : false,
          team2Passed: pair.team2 ? readTeamPassed(pair.team2, 2) : false,
          team1ExecutionTimeMs: pair.team1 ? readTeamExecutionTime(pair.team1, 1) : null,
          team2ExecutionTimeMs: pair.team2 ? readTeamExecutionTime(pair.team2, 2) : null,
        }));
    }

    const unifiedTestCases: TestCase[] = hiddenScoringCases.map((caseData) => caseData.testCase);

    const team1GameMadeTests = gameTestResults
      .filter((gt) => gt.type === "Game" && gt.teamNumber === 1)
      .sort((a, b) => a.position - b.position)
      .map((gt) => mapTeamGameMadeTestCase(gt, 1));

    const team2GameMadeTests = gameTestResults
      .filter((gt) => gt.type === "Game" && gt.teamNumber === 2)
      .sort((a, b) => a.position - b.position)
      .map((gt) => mapTeamGameMadeTestCase(gt, 2));

    const team1ActualOutputs = hiddenScoringCases.map((caseData) => caseData.team1Actual);
    const team2ActualOutputs = hiddenScoringCases.map((caseData) => caseData.team2Actual);
    const team1ErrorsArray = hiddenScoringCases.map((caseData) => caseData.team1Error);
    const team2ErrorsArray = hiddenScoringCases.map((caseData) => caseData.team2Error);

    const team1PassedCount = hiddenScoringCases.filter((caseData) => caseData.team1Passed).length;
    const team2PassedCountRaw = hiddenScoringCases.filter((caseData) => caseData.team2Passed).length;
    const isTwoPlayer = gameRoom.gameType === "TWOPLAYER";
    const team2PassedCount = isTwoPlayer ? 0 : team2PassedCountRaw;

    const team1TotalTests = hiddenScoringCases.length;
    const team2TotalTests = isTwoPlayer ? 0 : hiddenScoringCases.length;
    const scoringTotalTests = Math.max(team1TotalTests, team2TotalTests);

    const team1AverageExecutionTime = calculateAverageTime(
      hiddenScoringCases.map((caseData) => caseData.team1ExecutionTimeMs)
    );
    const team2AverageExecutionTimeRaw = calculateAverageTime(
      hiddenScoringCases.map((caseData) => caseData.team2ExecutionTimeMs)
    );
    const team2AverageExecutionTime = isTwoPlayer ? null : team2AverageExecutionTimeRaw;

    const team1SubmittedAt: string | null = gameRoom.gameResult?.team1SubmittedAt ?? null;
    const team2SubmittedAt: string | null = gameRoom.gameResult?.team2SubmittedAt ?? null;
    const team1TimeLeftSeconds = calculateTimeLeftSeconds(team1SubmittedAt);
    const team2TimeLeftSeconds = calculateTimeLeftSeconds(team2SubmittedAt);

    const team1Id = gameRoom.teams[0]?.id ?? null;
    const team2Id = gameRoom.teams[1]?.id ?? null;

    let nextWinningTeamId: string | null = null;
    if (isTwoPlayer) {
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
