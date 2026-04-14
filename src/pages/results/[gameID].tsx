import { useState, useEffect, useRef } from "react";
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
  IconHome,
  IconEye,
} from "@tabler/icons-react";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { usePostHog } from "posthog-js/react";
import { GameType } from "@prisma/client";
import styles from "@/styles/Results.module.css";
import AnalysisBox, { type AnalysisBoxProps } from "@/components/Analysisbox";
import ProblemBox, { type ActiveProblem } from "@/components/ProblemBox";
import TestCaseResultsBox from "@/components/TestCaseResultsBox";

// Mock data - replace with actual data from backend
interface TeamResult {
  name: string;
  score: number;
  testsPassed: number;
  totalTests: number;
  time: number; // in seconds
  isWinner: boolean;
}

interface RoomDetailsResponse {
  problem: ActiveProblem;
  gameType: GameType;
  team1Code: string | null;
  team2Code: string | null;
  userTeamNumber: 1 | 2;
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
  const posthog = usePostHog();
  const [problem, setProblem] = useState<ActiveProblem | null>(null);
  const [analysisProps, setAnalysisProps] = useState<AnalysisBoxProps | null>(null);
  const [userTeamNumber, setUserTeamNumber] = useState<1 | 2>(1);
  const [isProblemVisible, setIsProblemVisible] = useState(true);
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev);

  const [gameType, setGameType] = useState<GameType>(GameType.FOURPLAYER);
  const [isGameDataLoading, setIsGameDataLoading] = useState(true);

  useEffect(() => {
    posthog.capture("results_viewed");
  }, [posthog]);

  useEffect(() => {
    if (!router.isReady || !session?.user.id || !gameId) return;

    const loadGameData = async () => {
      try {
        const response = await fetch(`/api/rooms/${gameId}`);
        if (!response.ok) return;

        const roomDetails = (await response.json()) as RoomDetailsResponse;
        setProblem(roomDetails.problem);
        setGameType(roomDetails.gameType);
        setUserTeamNumber(roomDetails.userTeamNumber);

        if (roomDetails.team1Code || roomDetails.team2Code) {
          setAnalysisProps({
            team1Code: roomDetails.team1Code ?? "",
            team2Code: roomDetails.team2Code ?? undefined,
            gameType: roomDetails.gameType,
            userTeamNumber: roomDetails.userTeamNumber,
          });
        } else {
          setAnalysisProps(null);
        }
      } catch (error) {
        console.error("Failed to load room details for results page", error);
      } finally {
        setIsGameDataLoading(false);
      }
    };

    loadGameData();
  }, [gameId, router.isReady, session?.user.id]);

  const isCoOp = gameType === GameType.TWOPLAYER;

  // Mock data - replace with actual fetched data
  const coOpTeam: TeamResult = {
    name: "Co-Op Crew",
    score: 810,
    testsPassed: 9,
    totalTests: 10,
    time: 236, // 3:56
    isWinner: true
  };

  const greenTeam: TeamResult = {
    name: "Green Hackers",
    score: 850,
    testsPassed: 8,
    totalTests: 10,
    time: 245, // 4:05
    isWinner: true
  };

  const redTeam: TeamResult = {
    name: "Red Coders",
    score: 720,
    testsPassed: 7,
    totalTests: 10,
    time: 312, // 5:12
    isWinner: false
  };

  const primaryTeam = isCoOp ? coOpTeam : greenTeam;
  const secondaryTeam = isCoOp ? null : redTeam;

  const winner = secondaryTeam ? (primaryTeam.isWinner ? primaryTeam : secondaryTeam) : primaryTeam;

  // Animated counters
  const animatedScore = useCounter(winner.score, 2000, 200);
  const animatedTests = useCounter(winner.testsPassed, 1500, 400);
  const animatedTime = useCounter(winner.time, 1800, 600);

  if (!session) return null;

  if (isGameDataLoading) {
    return (
      <div className={styles.resultsPage}>
        <div className={styles.gradient} />
        <Navbar
          links={["Time", "Players", "Tournament"]}
          title="Code BattleGrounds"
        />
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

        <Navbar
          links={["Time", "Players", "Tournament"]}
          title="Code BattleGrounds"
        />

        <Container className={styles.container} size="xl">
          {/* Victory Banner */}
          <Box className={styles.victoryBanner}>
            <IconTrophy size={80} className={styles.trophyIcon} />
            <h1 className={styles.victoryTitle}>
              Victory!
            </h1>
            <p className={styles.victorySubtitle}>
              <span className={styles.winnerTeamName}>{winner.name}</span>{" "}
              {isCoOp ? "made it out of the battleground!" : "dominated the battlefield"}
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
                {animatedTests}/{winner.totalTests}
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
          {!isCoOp && secondaryTeam && (
            <div className={styles.comparisonSection}>
              <h2 className={styles.sectionTitle}>Team Performance</h2>

              <div className={styles.comparisonCard}>
                <div className={styles.comparisonHeader}>
                  <div className={styles.teamHeader}>
                    <div className={`${styles.teamName} ${primaryTeam.isWinner ? styles.teamNameWinner : styles.teamNameLoser}`}>
                      {primaryTeam.name}
                    </div>
                    <div className={`${styles.teamBadge} ${primaryTeam.isWinner ? styles.winnerBadge : styles.loserBadge}`}>
                      {primaryTeam.isWinner ? (
                        <>
                          <IconTrophy size={16} />
                          Winner
                        </>
                      ) : (
                        "Runner-up"
                      )}
                    </div>
                  </div>

                  <div className={styles.vsText}>VS</div>

                  <div className={styles.teamHeader}>
                    <div className={`${styles.teamName} ${secondaryTeam.isWinner ? styles.teamNameWinner : styles.teamNameLoser}`}>
                      {secondaryTeam.name}
                    </div>
                    <div className={`${styles.teamBadge} ${secondaryTeam.isWinner ? styles.winnerBadge : styles.loserBadge}`}>
                      {secondaryTeam.isWinner ? (
                        <>
                          <IconTrophy size={16} />
                          Winner
                        </>
                      ) : (
                        "Runner-up"
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.comparisonBody}>
                  <div className={styles.comparisonRow}>
                    <div className={`${styles.statValue} ${primaryTeam.score >= secondaryTeam.score ? styles.statValueWinner : styles.statValueLoser}`}>
                      {primaryTeam.score}
                    </div>
                    <div className={styles.statLabel}>Score</div>
                    <div className={`${styles.statValue} ${secondaryTeam.score >= primaryTeam.score ? styles.statValueWinner : styles.statValueLoser}`}>
                      {secondaryTeam.score}
                    </div>
                  </div>

                  <div className={styles.comparisonRow}>
                    <div className={`${styles.statValue} ${primaryTeam.testsPassed >= secondaryTeam.testsPassed ? styles.statValueWinner : styles.statValueLoser}`}>
                      {primaryTeam.testsPassed}/{primaryTeam.totalTests}
                    </div>
                    <div className={styles.statLabel}>Tests Passed</div>
                    <div className={`${styles.statValue} ${secondaryTeam.testsPassed >= primaryTeam.testsPassed ? styles.statValueWinner : styles.statValueLoser}`}>
                      {secondaryTeam.testsPassed}/{secondaryTeam.totalTests}
                    </div>
                  </div>

                  <div className={styles.comparisonRow}>
                    <div className={`${styles.statValue} ${primaryTeam.time <= secondaryTeam.time ? styles.statValueWinner : styles.statValueLoser}`}>
                      {formatTime(primaryTeam.time)}
                    </div>
                    <div className={styles.statLabel}>Time</div>
                    <div className={`${styles.statValue} ${secondaryTeam.time <= primaryTeam.time ? styles.statValueWinner : styles.statValueLoser}`}>
                      {formatTime(secondaryTeam.time)}
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
                  color: "white",
                  backgroundColor: "#333",
                  padding: "0",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: isProblemVisible ? "flex-start" : "center",
                  flexShrink: 0,
                  transition: "width 0.2s ease, min-width 0.2s ease",
                  borderRadius: "8px",
                }}
              >
                {isProblemVisible ? (
                  <Box style={{ width: "100%", flex: 1, minHeight: 0, padding: "1rem" }}>
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
                  gameId={gameId}
                  showOtherTeamColumn={!isCoOp}
                  gameType={gameType as "TWOPLAYER" | "FOURPLAYER"}
                  userTeamNumber={userTeamNumber}
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

            <Button
              size="lg"
              variant="outline"
              color="console"
              className={styles.secondaryButton}
              leftSection={<IconHome size={20} />}
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </Container>
      </div>
    </>
  );
}
