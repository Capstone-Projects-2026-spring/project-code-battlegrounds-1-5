import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Head from "next/head";
import {
  Container,
  Box,
  Button,
  Center,
  Loader,
  Stack,
  Flex,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconTrophy,
  IconClock,
  IconCode,
  IconMedal,
  IconTarget,
  IconBolt,
  IconArrowRight,
  // IconHome,
  IconEye,
  IconEqual,
} from "@tabler/icons-react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { GameType } from "@prisma/client";
import styles from "@/styles/Results.module.css";
import AnalysisBox, { type AnalysisBoxProps } from "@/components/Analysisbox";
import ProblemBox, { type ActiveProblem } from "@/components/ProblemBox";
import TestCaseResultsBox, { type TestResultsSummary } from "@/components/TestCaseResultsBox";
import { calculateScorePair } from "@/util/scoring";
import { useGameResults } from "@/hooks/useGameResults";

// Mock data - replace with actual data from backend
interface TeamResult {
  name: string;
  score: number;
  testsPassed: number;
  totalTests: number;
  time: number; // in seconds
  isWinner: boolean;
}

// Animated counter hook
function useCounter(end: number, duration: number = 1500, delay: number = 0) {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp;
        }

        const progress = timestamp - startTimeRef.current;
        const percentage = Math.min(progress / duration, 1);

        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - percentage, 4);
        const current = Math.floor(easeOutQuart * end);

        setCount(current);

        if (percentage < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [end, duration, delay]);

  return count;
}

// Format time helper
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function Page() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  // Early auth check to prevent loading all the heavy stuff
  // if we aren't even logged in
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth");
    }
  }, [isPending, session, router]);
  return <Results />;
}

export function Results() {
  //grab id from url
  const router = useRouter();
  const gameId = router.query.gameID as string;
  const { data: session } = authClient.useSession();

  // Fetch game results once
  const { data: gameResults, loading: isGameDataLoading } = useGameResults(
    router.isReady && session?.user.id ? gameId : undefined
  );

  const [isProblemVisible, setIsProblemVisible] = useState(true);
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev);

  const [testResultsSummary, setTestResultsSummary] = useState<TestResultsSummary | null>(null);

  useEffect(() => {
    setTestResultsSummary(null);
  }, [gameId]);

  const handleSummaryChange = useCallback((summary: TestResultsSummary) => {
    setTestResultsSummary((previous) => {
      if (
        previous &&
        previous.yourPassedCount === summary.yourPassedCount &&
        previous.otherTeamPassedCount === summary.otherTeamPassedCount &&
        previous.totalTests === summary.totalTests
      ) {
        return previous;
      }

      return summary;
    });
  }, []);

  // Extract data from gameResults for easier access
  const problem = gameResults?.problem ?? null;
  const gameType = (gameResults?.gameType as GameType) ?? GameType.FOURPLAYER;
  const userTeamNumber = gameResults?.userTeamNumber ?? 1;
  const analysisProps = gameResults?.team1Code || gameResults?.team2Code
    ? {
        team1Code: gameResults.team1Code ?? "",
        team2Code: gameResults.team2Code ?? undefined,
        gameType: gameResults.gameType as "TWOPLAYER" | "FOURPLAYER",
        userTeamNumber: gameResults.userTeamNumber,
        team1AverageExecutionTime: gameResults.team1AverageExecutionTime,
        team2AverageExecutionTime: gameResults.team2AverageExecutionTime,
      }
    : null;

  const isCoOp = gameType === GameType.TWOPLAYER;

  // Calculate team scores
  const [team1Score, team2Score] = useMemo(() => {
    if (!testResultsSummary || !analysisProps) return [0, 0];

    return calculateScorePair(
      testResultsSummary.yourPassedCount ?? 0,
      testResultsSummary.otherTeamPassedCount ?? 0,
      testResultsSummary.totalTests,
      analysisProps.team1AverageExecutionTime ?? null,
      analysisProps.team2AverageExecutionTime ?? null,
      userTeamNumber === 1 ? "Your Team (Team 1)" : "Other Team (Team 1)",
      userTeamNumber === 2 ? "Your Team (Team 2)" : "Other Team (Team 2)"
    );
  }, [testResultsSummary, analysisProps, userTeamNumber]);

  // Mock data - replace with actual fetched data
  const coOpTeam: TeamResult = {
    name: "Co-Op Crew",
    score: team1Score,
    testsPassed: testResultsSummary?.yourPassedCount ?? 0,
    totalTests: testResultsSummary?.totalTests ?? 0,
    time: 0, // Calculated later
    isWinner: true
  };

  const greenTeam: TeamResult = {
    name: "Green Hackers",
    score: userTeamNumber === 1 ? team1Score : team2Score,
    testsPassed: userTeamNumber === 1
      ? (testResultsSummary?.yourPassedCount ?? 0)
      : (testResultsSummary?.otherTeamPassedCount ?? 0),
    totalTests: testResultsSummary?.totalTests ?? 0,
    time: 0, // Calculated later
    isWinner: true
  };

  const redTeam: TeamResult = {
    name: "Red Coders",
    score: userTeamNumber === 1 ? team2Score : team1Score,
    testsPassed: userTeamNumber === 1
      ? (testResultsSummary?.otherTeamPassedCount ?? 0)
      : (testResultsSummary?.yourPassedCount ?? 0),
    totalTests: testResultsSummary?.totalTests ?? 0,
    time: 0, // Calculated later
    isWinner: false
  };

  const primaryTeam = isCoOp ? coOpTeam : (userTeamNumber === 1 ? greenTeam : redTeam);
  const secondaryTeam = isCoOp ? null : (userTeamNumber === 1 ? redTeam : greenTeam);

  // Helper to get team color class based on team name
  const getTeamColorClass = (team: TeamResult) => {
    if (team.name === "Green Hackers") return styles.teamNameGreen;
    if (team.name === "Red Coders") return styles.teamNameRed;
    return styles.teamName;
  };

  // Determine if it's a tie
  const isTie = secondaryTeam ? primaryTeam.score === secondaryTeam.score : false;

  // Update team winner status based on tie (create new objects instead of mutating)
  const updatedPrimaryTeam = {
    ...primaryTeam,
    isWinner: secondaryTeam
      ? isTie
        ? false
        : primaryTeam.score > secondaryTeam.score
      : true
  };

  const updatedSecondaryTeam = secondaryTeam
    ? {
        ...secondaryTeam,
        isWinner: isTie ? false : primaryTeam.score < secondaryTeam.score
      }
    : null;

  // Determine winner based on actual score comparison
  const winner = updatedSecondaryTeam
    ? isTie
      ? updatedPrimaryTeam
      : updatedPrimaryTeam.isWinner ? updatedPrimaryTeam : updatedSecondaryTeam
    : updatedPrimaryTeam;
  const areTestResultsLoading = testResultsSummary === null;
  const testsPassedForMetric = testResultsSummary?.yourPassedCount ?? 0;
  const totalTestsForMetric = testResultsSummary?.totalTests ?? 0;

  const primaryTeamTestsPassed = !areTestResultsLoading && !isCoOp
    ? (testResultsSummary?.yourPassedCount ?? 0)
    : 0;

  const secondaryTeamTestsPassed = !areTestResultsLoading && !isCoOp
    ? (testResultsSummary?.otherTeamPassedCount ?? 0)
    : 0;

  const comparisonTotalTests = testResultsSummary?.totalTests ?? 0;

  // Animated counters - show user's team metrics
  const userTeamScore = team1Score;  // team1Score is always yourScore from calculateScorePair
  const animatedScore = useCounter(userTeamScore, 2000, 200);
  const animatedTests = useCounter(areTestResultsLoading ? 0 : testsPassedForMetric, 1500, 400);
  const animatedTime = useCounter(winner.time, 1800, 600);

  // Determine if user's team won
  const userTeamWon = !isTie && updatedPrimaryTeam.score > (updatedSecondaryTeam?.score ?? 0);

  if (!session) return null;

  if (isGameDataLoading) {
    return (
      <div className={styles.resultsPage}>
        <div className={styles.gradient} />
        <Center style={{ minHeight: "60vh", position: "relative", zIndex: 1 }}>
          <Loader color="console" size="lg" />
        </Center>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Match Results | Code BattleGrounds</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.resultsPage}>
        <div className={styles.gradient} />

        <Container className={styles.container} size="xl">
          {/* Victory/Defeat Banner */}
          <Box className={styles.victoryBanner}>
            {userTeamWon ? (
              <IconTrophy size={80} className={styles.trophyIcon} />
            ) : isTie ? (
              <IconEqual size={80} className={styles.tieIcon} />
            ) : (
              <div style={{ fontSize: '80px', fontWeight: 'bold', color: '#ff0000', lineHeight: 1 }}>L</div>
            )}
            <h1 className={userTeamWon ? styles.victoryTitle : isTie ? styles.tieTitle : styles.defeatTitle}>
              {userTeamWon ? "Victory!" : isTie ? "Perfectly Matched!" : "Defeat!"}
            </h1>
            <p className={styles.victorySubtitle}>
              {isCoOp
                ? "made it out of the battleground!"
                : isTie
                ? "Both teams showcased equal skill!"
                : userTeamWon
                ? <span><span className={styles.winnerTeamName}>{winner.name}</span> dominated the battlefield!</span>
                : <span><span className={styles.winnerTeamName}>{winner.name}</span> dominated the battlefield!</span>
              }
            </p>
          </Box>

          {/* Key Metrics */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>
                <IconTrophy size={16} />
                Final Score
              </div>
              <div className={styles.metricValue}>
                {animatedScore}
              </div>
              <IconMedal size={64} className={styles.metricIcon} />
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>
                <IconTarget size={16} />
                Tests Passed
              </div>
              <div className={styles.metricValue}>
                {!areTestResultsLoading && `${animatedTests}/${totalTestsForMetric}`}
                {areTestResultsLoading && (<Loader />)}
              </div>
              <IconCode size={64} className={styles.metricIcon} />
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>
                <IconClock size={16} />
                Completion Time
              </div>
              <div className={styles.metricValue}>
                {formatTime(animatedTime)}
              </div>
              <IconBolt size={64} className={styles.metricIcon} />
            </div>
          </div>

          {/* Team Comparison */}
          {!isCoOp && updatedSecondaryTeam && (
            <div className={styles.comparisonSection}>
              <h2 className={styles.sectionTitle}>Team Performance</h2>

              <div className={styles.comparisonCard}>
                <div className={styles.comparisonHeader}>
                  <div className={styles.teamHeader}>
                    <div className={`${styles.teamName} ${getTeamColorClass(updatedPrimaryTeam)}`}>
                      {updatedPrimaryTeam.name}
                    </div>
                    <div className={`${styles.teamBadge} ${updatedPrimaryTeam.isWinner ? styles.winnerBadge : isTie ? styles.tieBadge : styles.loserBadge}`}>
                      {updatedPrimaryTeam.isWinner ? (
                        <>
                          <IconTrophy size={16} />
                          Winner
                        </>
                      ) : isTie ? (
                        <>
                          <IconEqual size={16} />
                          Tied
                        </>
                      ) : (
                        "Runner-up"
                      )}
                    </div>
                  </div>

                  <div className={styles.vsText}>VS</div>

                  <div className={styles.teamHeader}>
                    <div className={`${styles.teamName} ${getTeamColorClass(updatedSecondaryTeam)}`}>
                      {updatedSecondaryTeam.name}
                    </div>
                    <div className={`${styles.teamBadge} ${updatedSecondaryTeam.isWinner ? styles.winnerBadge : isTie ? styles.tieBadge : styles.loserBadge}`}>
                      {updatedSecondaryTeam.isWinner ? (
                        <>
                          <IconTrophy size={16} />
                          Winner
                        </>
                      ) : isTie ? (
                        <>
                          <IconEqual size={16} />
                          Tied
                        </>
                      ) : (
                        "Runner-up"
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.comparisonBody}>
                  <div className={styles.comparisonRow}>
                    <div className={`${styles.statValue} ${isTie ? styles.statValueTie : updatedPrimaryTeam.score > updatedSecondaryTeam.score ? styles.statValueWinner : styles.statValueLoser}`}>
                      {updatedPrimaryTeam.score}
                    </div>
                    <div className={styles.statLabel}>Score</div>
                    <div className={`${styles.statValue} ${isTie ? styles.statValueTie : updatedSecondaryTeam.score > updatedPrimaryTeam.score ? styles.statValueWinner : styles.statValueLoser}`}>
                      {updatedSecondaryTeam.score}
                    </div>
                  </div>

                  <div className={styles.comparisonRow}>
                    {areTestResultsLoading ? (
                      <>
                        <div className={`${styles.statValue} ${styles.statValueLoser}`}>Loading...</div>
                        <div className={styles.statLabel}>Tests Passed</div>
                        <div className={`${styles.statValue} ${styles.statValueLoser}`}>Loading...</div>
                      </>
                    ) : (
                      <>
                        <div className={`${styles.statValue} ${primaryTeamTestsPassed === secondaryTeamTestsPassed ? styles.statValueTie : primaryTeamTestsPassed > secondaryTeamTestsPassed ? styles.statValueWinner : styles.statValueLoser}`}>
                          {primaryTeamTestsPassed}/{comparisonTotalTests}
                        </div>
                        <div className={styles.statLabel}>Tests Passed</div>
                        <div className={`${styles.statValue} ${primaryTeamTestsPassed === secondaryTeamTestsPassed ? styles.statValueTie : secondaryTeamTestsPassed > primaryTeamTestsPassed ? styles.statValueWinner : styles.statValueLoser}`}>
                          {secondaryTeamTestsPassed}/{comparisonTotalTests}
                        </div>
                      </>
                    )}
                  </div>

                  <div className={styles.comparisonRow}>
                    <div className={`${styles.statValue} ${updatedPrimaryTeam.time === updatedSecondaryTeam.time ? styles.statValueTie : updatedPrimaryTeam.time < updatedSecondaryTeam.time ? styles.statValueWinner : styles.statValueLoser}`}>
                      {formatTime(updatedPrimaryTeam.time)}
                    </div>
                    <div className={styles.statLabel}>Time</div>
                    <div className={`${styles.statValue} ${updatedPrimaryTeam.time === updatedSecondaryTeam.time ? styles.statValueTie : updatedSecondaryTeam.time < updatedPrimaryTeam.time ? styles.statValueWinner : styles.statValueLoser}`}>
                      {formatTime(updatedSecondaryTeam.time)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Code + Test Breakdown */}
          <div className={styles.testResultsSection}>
            <h2 className={styles.sectionTitle}>
              {isCoOp ? "Co-Op Code & Test Breakdown" : "Match Code & Test Breakdown"}
            </h2>

            <Flex gap="md" align="stretch" wrap="wrap">
              <Box
                style={{
                  width: isProblemVisible ? "30%" : "52px",
                  minWidth: isProblemVisible ? "260px" : "52px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: isProblemVisible ? "flex-start" : "center",
                  flexShrink: 0,
                  transition: "width 0.2s ease, min-width 0.2s ease",
                }}
              >
                {isProblemVisible ? (
                  <Box style={{
                    width: "100%",
                    flex: 1,
                    minHeight: 0,
                  }}>
                    <ProblemBox problem={problem} onToggleVisibility={toggleProblemVisibility} />
                  </Box>
                ) : (
                  <Tooltip label="Show Problem">
                    <ActionIcon
                      variant="transparent"
                      color="gray"
                      size="xl"
                      onClick={toggleProblemVisibility}
                      title="Show Problem"
                    >
                      <IconEye size={24} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Box>

              <Stack style={{ flex: 2, minWidth: "320px" }} gap="md">
                <AnalysisBox
                  {...(analysisProps ?? {
                    team1Code: "",
                    gameType: gameType as "TWOPLAYER" | "FOURPLAYER",
                    userTeamNumber,
                  })}
                />
                <TestCaseResultsBox
                  tests={gameResults?.tests}
                  team1Results={gameResults?.team1Results}
                  team2Results={gameResults?.team2Results}
                  team1Errors={gameResults?.team1Errors}
                  team2Errors={gameResults?.team2Errors}
                  showOtherTeamColumn={gameType !== GameType.TWOPLAYER}
                  gameType={gameType as "TWOPLAYER" | "FOURPLAYER"}
                  userTeamNumber={userTeamNumber}
                  onSummaryChange={handleSummaryChange}
                />
              </Stack>
            </Flex>
          </div>

          {/* Action Buttons */}
          <div className={styles.actionsSection}>
            <Button
              size="lg"
              variant="filled"
              color="console"
              className={styles.primaryButton}
              rightSection={<IconArrowRight size={20} />}
              onClick={() => router.push('/matchmaking')}
            >
              Play Again
            </Button>

            {/* <Button
              size="lg"
              variant="outline"
              color="console"
              className={styles.secondaryButton}
              leftSection={<IconHome size={20} />}
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button> */}
          </div>
        </Container>
      </div>
    </>
  );
}
