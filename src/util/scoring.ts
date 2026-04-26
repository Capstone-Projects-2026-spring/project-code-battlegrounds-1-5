export const SCORING_WEIGHTS = {
  testsPassed: 0.8,    // 80% - heavy weighting
  runtime: 0.2,        // 20% - light weighting
} as const;

const RUNTIME_THRESHOLD = 0.10; // 10% difference required to award runtime points
const MAX_REASONABLE_RUNTIME_MS = 5000; // Assumes <5000ms is max reasonable time for fallback scoring
const SHOULD_LOG_SCORE_BREAKDOWN = process.env.NEXT_PUBLIC_DEBUG_SCORING === "true";

function logScoreBreakdown(
  teamLabel: string,
  testScore: number,
  runtimeScore: number,
  totalScore: number
) {
  if (!SHOULD_LOG_SCORE_BREAKDOWN) return;

  console.log(
    `[${teamLabel}] Score Breakdown: Tests=${testScore.toFixed(2)}, Runtime=${runtimeScore.toFixed(2)}, Total=${totalScore}`
  );
}

export function calculateScore(
  testsPassed: number,
  totalTests: number,
  runtimeMs: number | null,
  teamLabel: string = "Team"
): number {
  if (totalTests === 0) return 0;

  const testsRatio = testsPassed / totalTests;
  const testScore = testsRatio * 1000 * SCORING_WEIGHTS.testsPassed;

  // Inverse of runtime: faster = higher score
  // Normalize to 0-1000 scale (assuming <5000ms is max reasonable time)
  const runtimeScore = runtimeMs
    ? Math.max(0, (1 - runtimeMs / MAX_REASONABLE_RUNTIME_MS)) * 1000 * SCORING_WEIGHTS.runtime
    : 0;

  const totalScore = Math.round(testScore + runtimeScore);
  logScoreBreakdown(teamLabel, testScore, runtimeScore, totalScore);

  return totalScore;
}

/**
 * Calculate scores for both teams with percentage-based runtime threshold
 * Only awards runtime points if the runtime difference exceeds the threshold
 */
export function calculateScorePair(
  team1TestsPassed: number,
  team2TestsPassed: number,
  totalTests: number,
  team1RuntimeMs: number | null,
  team2RuntimeMs: number | null,
  team1Label: string = "Team 1",
  team2Label: string = "Team 2"
): [number, number] {
  // Calculate test scores
  const testsRatio1 = totalTests > 0 ? team1TestsPassed / totalTests : 0;
  const testScore1 = testsRatio1 * 1000 * SCORING_WEIGHTS.testsPassed;

  const testsRatio2 = totalTests > 0 ? team2TestsPassed / totalTests : 0;
  const testScore2 = testsRatio2 * 1000 * SCORING_WEIGHTS.testsPassed;

  // Calculate runtime scores with percentage threshold
  let runtimeScore1 = 0;
  let runtimeScore2 = 0;

  if (team1RuntimeMs !== null && team2RuntimeMs !== null) {
    const runtimeDiff = Math.abs(team1RuntimeMs - team2RuntimeMs);
    const maxRuntime = Math.max(team1RuntimeMs, team2RuntimeMs);
    const requiredDifference = maxRuntime * RUNTIME_THRESHOLD;

    if (runtimeDiff > requiredDifference) {
      // Only award runtime points if difference exceeds threshold
      const baseScore = 1000 * SCORING_WEIGHTS.runtime;

      if (team1RuntimeMs < team2RuntimeMs) {
        runtimeScore1 = baseScore;
        runtimeScore2 = 0;
      } else {
        runtimeScore1 = 0;
        runtimeScore2 = baseScore;
      }
    }
    // If difference is below threshold, both get 0 runtime points
  } else if (team1RuntimeMs !== null) {
    // Fallback for 2-player: use inverse of runtime
    runtimeScore1 = Math.max(0, (1 - team1RuntimeMs / MAX_REASONABLE_RUNTIME_MS)) * 1000 * SCORING_WEIGHTS.runtime;
  } else if (team2RuntimeMs !== null) {
    runtimeScore2 = Math.max(0, (1 - team2RuntimeMs / MAX_REASONABLE_RUNTIME_MS)) * 1000 * SCORING_WEIGHTS.runtime;
  }

  const totalScore1 = Math.round(testScore1 + runtimeScore1);
  const totalScore2 = Math.round(testScore2 + runtimeScore2);

  logScoreBreakdown(team1Label, testScore1, runtimeScore1, totalScore1);
  logScoreBreakdown(team2Label, testScore2, runtimeScore2, totalScore2);

  return [totalScore1, totalScore2];
}

