import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { Container, Box, Group, Text, Button, Stack } from "@mantine/core";
import { 
  IconTrophy, 
  IconClock, 
  IconCode, 
  IconMedal,
  IconCheck,
  IconX,
  IconFlame,
  IconTarget,
  IconBolt,
  IconArrowRight,
  IconHome
} from "@tabler/icons-react";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { usePostHog } from "posthog-js/react";
import styles from "@/styles/Results.module.css";

// Mock data - replace with actual data from backend
interface TeamResult {
  name: string;
  score: number;
  testsPassed: number;
  totalTests: number;
  time: number; // in seconds
  isWinner: boolean;
}

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
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

export default function Results() {
  const router = useRouter();
  const { gameID } = router.query;
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();

  useEffect(() => {
    posthog.capture("results_viewed");
  }, [posthog]);

  if (!session) return null;

  // Mock data - replace with actual fetched data
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

  const testResults: TestResult[] = [
    { id: 1, name: "Basic Input", passed: true, input: "[1,2,3]", expected: "6", actual: "6" },
    { id: 2, name: "Edge Case - Empty", passed: true, input: "[]", expected: "0", actual: "0" },
    { id: 3, name: "Large Numbers", passed: true, input: "[100,200,300]", expected: "600", actual: "600" },
    { id: 4, name: "Negative Values", passed: false, input: "[-1,-2,-3]", expected: "-6", actual: "Error" },
    { id: 5, name: "Mixed Values", passed: true, input: "[1,-1,2,-2]", expected: "0", actual: "0" },
  ];

  const winner = greenTeam.isWinner ? greenTeam : redTeam;
  
  // Animated counters
  const animatedScore = useCounter(winner.score, 2000, 200);
  const animatedTests = useCounter(greenTeam.testsPassed, 1500, 400);
  const animatedTime = useCounter(greenTeam.time, 1800, 600);

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
              <span className={styles.winnerTeamName}>{winner.name}</span> dominated the battlefield
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
                {animatedTests}/{greenTeam.totalTests}
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
          <div className={styles.comparisonSection}>
            <h2 className={styles.sectionTitle}>Team Performance</h2>
            
            <div className={styles.comparisonCard}>
              <div className={styles.comparisonHeader}>
                <div className={styles.teamHeader}>
                  <div className={`${styles.teamName} ${greenTeam.isWinner ? styles.teamNameWinner : styles.teamNameLoser}`}>
                    {greenTeam.name}
                  </div>
                  <div className={`${styles.teamBadge} ${greenTeam.isWinner ? styles.winnerBadge : styles.loserBadge}`}>
                    {greenTeam.isWinner ? (
                      <>
                        <IconTrophy size={16} />
                        Winner
                      </>
                    ) : (
                      'Runner-up'
                    )}
                  </div>
                </div>

                <div className={styles.vsText}>VS</div>

                <div className={styles.teamHeader}>
                  <div className={`${styles.teamName} ${redTeam.isWinner ? styles.teamNameWinner : styles.teamNameLoser}`}>
                    {redTeam.name}
                  </div>
                  <div className={`${styles.teamBadge} ${redTeam.isWinner ? styles.winnerBadge : styles.loserBadge}`}>
                    {redTeam.isWinner ? (
                      <>
                        <IconTrophy size={16} />
                        Winner
                      </>
                    ) : (
                      'Runner-up'
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.comparisonBody}>
                <div className={styles.comparisonRow}>
                  <div className={`${styles.statValue} ${greenTeam.score >= redTeam.score ? styles.statValueWinner : styles.statValueLoser}`}>
                    {greenTeam.score}
                  </div>
                  <div className={styles.statLabel}>Score</div>
                  <div className={`${styles.statValue} ${redTeam.score >= greenTeam.score ? styles.statValueWinner : styles.statValueLoser}`}>
                    {redTeam.score}
                  </div>
                </div>

                <div className={styles.comparisonRow}>
                  <div className={`${styles.statValue} ${greenTeam.testsPassed >= redTeam.testsPassed ? styles.statValueWinner : styles.statValueLoser}`}>
                    {greenTeam.testsPassed}/{greenTeam.totalTests}
                  </div>
                  <div className={styles.statLabel}>Tests Passed</div>
                  <div className={`${styles.statValue} ${redTeam.testsPassed >= greenTeam.testsPassed ? styles.statValueWinner : styles.statValueLoser}`}>
                    {redTeam.testsPassed}/{redTeam.totalTests}
                  </div>
                </div>

                <div className={styles.comparisonRow}>
                  <div className={`${styles.statValue} ${greenTeam.time <= redTeam.time ? styles.statValueWinner : styles.statValueLoser}`}>
                    {formatTime(greenTeam.time)}
                  </div>
                  <div className={styles.statLabel}>Time</div>
                  <div className={`${styles.statValue} ${redTeam.time <= greenTeam.time ? styles.statValueWinner : styles.statValueLoser}`}>
                    {formatTime(redTeam.time)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Cards */}
          <div className={styles.performanceSection}>
            <h2 className={styles.sectionTitle}>Performance Breakdown</h2>
            
            <div className={styles.performanceGrid}>
              <div className={styles.performanceCard}>
                <div className={styles.performanceHeader}>
                  <div className={styles.performanceTitle}>Accuracy</div>
                  <IconTarget size={24} className={styles.performanceIcon} />
                </div>
                <div className={styles.performanceScore}>
                  {Math.round((greenTeam.testsPassed / greenTeam.totalTests) * 100)}%
                </div>
                <div className={styles.performanceDescription}>
                  Excellent test coverage with {greenTeam.testsPassed} out of {greenTeam.totalTests} tests passing
                </div>
              </div>

              <div className={styles.performanceCard}>
                <div className={styles.performanceHeader}>
                  <div className={styles.performanceTitle}>Speed</div>
                  <IconBolt size={24} className={styles.performanceIcon} />
                </div>
                <div className={styles.performanceScore}>
                  A+
                </div>
                <div className={styles.performanceDescription}>
                  Completed in {formatTime(greenTeam.time)} - faster than {greenTeam.time < redTeam.time ? '80%' : '60%'} of teams
                </div>
              </div>

              <div className={styles.performanceCard}>
                <div className={styles.performanceHeader}>
                  <div className={styles.performanceTitle}>Efficiency</div>
                  <IconFlame size={24} className={styles.performanceIcon} />
                </div>
                <div className={styles.performanceScore}>
                  {greenTeam.score}
                </div>
                <div className={styles.performanceDescription}>
                  Outstanding score combining speed, accuracy, and code quality
                </div>
              </div>
            </div>
          </div>

          {/* Test Results */}
          <div className={styles.testResultsSection}>
            <h2 className={styles.sectionTitle}>Test Case Results</h2>
            
            <div className={styles.testResultsCard}>
              <div className={styles.testResultsHeader}>
                <div className={styles.testResultsTitle}>
                  All Test Cases
                </div>
              </div>
              
              <div className={styles.testResultsBody}>
                {testResults.map((test, index) => (
                  <div key={test.id} className={styles.testRow}>
                    <div className={`${styles.testStatus} ${test.passed ? styles.testStatusPass : styles.testStatusFail}`}>
                      {test.passed ? <IconCheck size={18} /> : <IconX size={18} />}
                    </div>
                    <div className={styles.testInfo}>
                      <div className={styles.testName}>
                        Test {test.id}: {test.name}
                      </div>
                      <div className={styles.testDetails}>
                        Input: {test.input} → Expected: {test.expected} | Got: {test.actual}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
