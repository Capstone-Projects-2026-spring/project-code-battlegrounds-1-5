import { Paper, Text, Group, Box, Badge, Title, Divider, Code } from "@mantine/core";
import styles from "@/styles/comps/AnalysisBox.module.css";

export interface AnalysisBoxProps {
  team1Code: string;
  team2Code?: string;
  gameType?: "TWOPLAYER" | "FOURPLAYER";
  userTeamNumber?: 1 | 2;
}

export default function AnalysisBox({ team1Code, team2Code, gameType = "FOURPLAYER", userTeamNumber = 1 }: AnalysisBoxProps) {
  const hasAnyCode = Boolean(team1Code || team2Code);

  const primaryCodeLabel =
    gameType === "TWOPLAYER"
      ? "Your Code"
      : userTeamNumber === 1
        ? "Your Code (Team 1)"
        : "Team 1";

  const secondaryCodeLabel =
    gameType === "TWOPLAYER" ? "Your Code" : "Your Code (Team 2)";

  const primaryMetricsLabel =
    gameType === "TWOPLAYER"
      ? "Your Metrics"
      : userTeamNumber === 1
        ? "Your Metrics (Team 1)"
        : "Team 1 Metrics";

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder className={styles.container}>

      <Box className={styles.content}>
        <Title order={4} mb="sm" className={styles.title}>
          Solution Analysis
        </Title>
        <Text size="sm" c="dimmed" lh={1.6} className={styles.subtitle}>
          {hasAnyCode ? "Captured final submissions for review." : "No code entered"}
        </Text>

        {/* Side-by-side code containers */}
        <Box className={styles.codeGrid}>
          {userTeamNumber === 2 && team2Code && (
            <Box className={styles.codePanel}>
              <Text size="xs" fw={600} mb="xs" className={styles.panelLabel}>
                {secondaryCodeLabel}
              </Text>
              <Box className={styles.codeScroll}>
                <Code block mt={0} ff="monospace" className={styles.codeBlock}>
                  {team2Code}
                </Code>
              </Box>
            </Box>
          )}

          {/* Team 1 Code */}
          {team1Code && (
            <Box className={styles.codePanel}>
              <Text size="xs" fw={600} mb="xs" className={styles.panelLabel}>
                {primaryCodeLabel}
              </Text>
              <Box className={styles.codeScroll}>
                <Code block mt={0} ff="monospace" className={styles.codeBlock}>
                  {team1Code}
                </Code>
              </Box>
            </Box>
          )}

          {userTeamNumber === 1 && team2Code && (
            <Box className={styles.codePanel}>
              <Text size="xs" fw={600} mb="xs" className={styles.panelLabel}>
                Team 2
              </Text>
              <Box className={styles.codeScroll}>
                <Code block mt={0} ff="monospace" className={styles.codeBlock}>
                  {team2Code}
                </Code>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Divider my="md" className={styles.divider} />

      {/* Performance Metrics - Horizontal layout */}
      <Box className={styles.metricsGrid}>
        {userTeamNumber === 2 && team2Code && (
          <Box className={styles.metricCard}>
            <Text size="xs" fw={600} mb="xs" className={styles.metricTitle}>
              Your Metrics (Team 2)
            </Text>
            <Group gap="xs" className={styles.badgeGroup}>
              <Badge color="teal" variant="light" size="md" radius="sm" className={`${styles.metricBadge} ${styles.runtimeBadge}`}>
                Runtime: A
              </Badge>
              <Badge color="yellow" variant="light" size="md" radius="sm" className={`${styles.metricBadge} ${styles.spaceBadge}`}>
                Space: B
              </Badge>
              <Badge color="orange" variant="light" size="md" radius="sm" className={`${styles.metricBadge} ${styles.timeBadge}`}>
                Time: C
              </Badge>
            </Group>
          </Box>
        )}

        <Box className={styles.metricCard}>
          <Text size="xs" fw={600} mb="xs" className={styles.metricTitle}>
            {primaryMetricsLabel}
          </Text>
          <Group gap="xs" className={styles.badgeGroup}>
            <Badge color="teal" variant="light" size="md" radius="sm" className={`${styles.metricBadge} ${styles.runtimeBadge}`}>
              Runtime: A
            </Badge>
            <Badge color="yellow" variant="light" size="md" radius="sm" className={`${styles.metricBadge} ${styles.spaceBadge}`}>
              Space: B
            </Badge>
            <Badge color="orange" variant="light" size="md" radius="sm" className={`${styles.metricBadge} ${styles.timeBadge}`}>
              Time: C
            </Badge>
          </Group>
        </Box>

        {userTeamNumber === 1 && team2Code && (
          <Box className={styles.metricCard}>
            <Text size="xs" fw={600} mb="xs" className={styles.metricTitle}>
              Team 2 Metrics
            </Text>
            <Group gap="xs" className={styles.badgeGroup}>
              <Badge color="teal" variant="light" size="md" radius="sm" className={`${styles.metricBadge} ${styles.runtimeBadge}`}>
                Runtime: A
              </Badge>
              <Badge color="yellow" variant="light" size="md" radius="sm" className={`${styles.metricBadge} ${styles.spaceBadge}`}>
                Space: B
              </Badge>
              <Badge color="orange" variant="light" size="md" radius="sm" className={`${styles.metricBadge} ${styles.timeBadge}`}>
                Time: C
              </Badge>
            </Group>
          </Box>
        )}

      </Box>

    </Paper>
  );
}