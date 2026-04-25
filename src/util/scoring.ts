export const SCORING_WEIGHTS = {
  testsPassed: 0.7, // 70% - heavy weighting
  runtime: 0.15, // 15% - light weighting
  timeSubmitted: 0.15, // 15% - light weighting (submission-time bucketed penalty)
} as const;

const RUNTIME_THRESHOLD = 0.05; // 5% difference required to award runtime points
const MAX_REASONABLE_RUNTIME_MS = 5000; // Assumes <5000ms is max reasonable time for fallback scoring
const TIME_INTERVAL_SECONDS = 30; // Every 30 seconds reduces the time score by 10%
const SHOULD_LOG_SCORE_BREAKDOWN = process.env.NEXT_PUBLIC_DEBUG_SCORING === "true";

function logScoreBreakdown(
  teamLabel: string,
  testScore: number,
  runtimeScore: number,
  timeScore: number,
  totalScore: number
) {
  if (!SHOULD_LOG_SCORE_BREAKDOWN) return;

  console.log(
    `[${teamLabel}] Score Breakdown: Tests=${testScore.toFixed(2)}, Runtime=${runtimeScore.toFixed(2)}, Time=${timeScore.toFixed(2)}, Total=${totalScore}`
  );
}

function parseSubmissionTime(timeSubmitted: string | null | undefined): number | null {
  if (!timeSubmitted) return null;

  const trimmed = timeSubmitted.trim();
  const match = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;

  return minutes * 60 + seconds;
}

function calculateTimeScore(
  timeLeftSeconds: number | null
): number {
  if (timeLeftSeconds === null) return 0;

  const elapsedSeconds = Math.max(0, 300 - timeLeftSeconds);
  const penaltySteps = Math.floor(elapsedSeconds / TIME_INTERVAL_SECONDS);
  const normalizedScore = Math.max(0, 1 - penaltySteps * 0.1);

  return normalizedScore * 1000 * SCORING_WEIGHTS.timeSubmitted;
}

export function calculateScore(
  testsPassed: number,
  totalTests: number,
  runtimeMs: number | null,
  timeLeftSeconds: number | null,
  teamLabel: string = "Team"
): number {
  if (totalTests === 0) return 0;

  const testsRatio = testsPassed / totalTests;
  const testScore = testsRatio * 1000 * SCORING_WEIGHTS.testsPassed;

  const runtimeScore = runtimeMs
    ? Math.max(0, (1 - runtimeMs / MAX_REASONABLE_RUNTIME_MS)) * 1000 * SCORING_WEIGHTS.runtime
    : 0;

  const timeScore = calculateTimeScore(timeLeftSeconds);

  const totalScore = Math.round(testScore + runtimeScore + timeScore);
  logScoreBreakdown(teamLabel, testScore, runtimeScore, timeScore, totalScore);

  return totalScore;
}

/**
 * Calculate scores for both teams with percentage-based runtime threshold.
 * Submission time is scored independently for each team in 30-second buckets.
 */
export function calculateScorePair(
  team1TestsPassed: number,
  team2TestsPassed: number,
  totalTests: number,
  team1RuntimeMs: number | null,
  team2RuntimeMs: number | null,
  team1TimeLeftSeconds: number | null = null,
  team2TimeLeftSeconds: number | null = null,
  team1Label: string = "Team 1",
  team2Label: string = "Team 2"
): [number, number] {
  const testsRatio1 = totalTests > 0 ? team1TestsPassed / totalTests : 0;
  const testScore1 = testsRatio1 * 1000 * SCORING_WEIGHTS.testsPassed;

  const testsRatio2 = totalTests > 0 ? team2TestsPassed / totalTests : 0;
  const testScore2 = testsRatio2 * 1000 * SCORING_WEIGHTS.testsPassed;

  let runtimeScore1 = 0;
  let runtimeScore2 = 0;

  if (team1RuntimeMs !== null && team2RuntimeMs !== null) {
    const runtimeDiff = Math.abs(team1RuntimeMs - team2RuntimeMs);
    const maxRuntime = Math.max(team1RuntimeMs, team2RuntimeMs);
    const requiredDifference = maxRuntime * RUNTIME_THRESHOLD;

    if (runtimeDiff > requiredDifference) {
      const baseScore = 1000 * SCORING_WEIGHTS.runtime;

      if (team1RuntimeMs < team2RuntimeMs) {
        runtimeScore1 = baseScore;
      } else {
        runtimeScore2 = baseScore;
      }
    }
  } else if (team1RuntimeMs !== null) {
    runtimeScore1 = Math.max(0, (1 - team1RuntimeMs / MAX_REASONABLE_RUNTIME_MS)) * 1000 * SCORING_WEIGHTS.runtime;
  } else if (team2RuntimeMs !== null) {
    runtimeScore2 = Math.max(0, (1 - team2RuntimeMs / MAX_REASONABLE_RUNTIME_MS)) * 1000 * SCORING_WEIGHTS.runtime;
  }

  const timeScore1 = calculateTimeScore(team1TimeLeftSeconds);
  const timeScore2 = calculateTimeScore(team2TimeLeftSeconds);

  const totalScore1 = Math.round(testScore1 + runtimeScore1 + timeScore1);
  const totalScore2 = Math.round(testScore2 + runtimeScore2 + timeScore2);

  logScoreBreakdown(team1Label, testScore1, runtimeScore1, timeScore1, totalScore1);
  logScoreBreakdown(team2Label, testScore2, runtimeScore2, timeScore2, totalScore2);

  return [totalScore1, totalScore2];
}

