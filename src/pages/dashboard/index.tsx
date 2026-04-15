import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { Container, Box, Text, Button, Loader, Center } from "@mantine/core";
import {
  IconTrophy,
  IconChartBar,
  IconTarget,
  IconPlayerPlay,
  IconHistory,
  IconChartLine,
  IconSwords,
  IconClock,
} from "@tabler/icons-react";
import classes from "@/styles/Dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const posthog = usePostHog();
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    winRate: 0,
    rank: 0,
  });

  interface RecentGame {
    id: number;
    opponent: string;
    result: "win" | "loss";
    score: string;
    date: string;
  }

  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [isPending, session, router]);

  useEffect(() => {
    if (session) {
      // Simulated stats - replace with actual API calls
      setTimeout(() => {
        setStats({
          gamesPlayed: 42,
          winRate: 68,
          rank: 1247,
        });
        setRecentGames([
          {
            id: 1,
            opponent: "CodeMaster_42",
            result: "win",
            score: "450 - 320",
            date: "2 hours ago",
          },
          {
            id: 2,
            opponent: "DevNinja_99",
            result: "win",
            score: "520 - 480",
            date: "5 hours ago",
          },
          {
            id: 3,
            opponent: "BugHunter_XL",
            result: "loss",
            score: "390 - 410",
            date: "1 day ago",
          },
          {
            id: 4,
            opponent: "AlgoWizard_13",
            result: "win",
            score: "510 - 445",
            date: "2 days ago",
          },
        ]);
      }, 500);
    }
  }, [session]);

  const handleQuickAction = (action: string) => {
    posthog?.capture(`dashboard_${action}_clicked`);
    switch (action) {
      case "new_game":
        router.push("/matchmaking");
        break;
      case "signout":
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/login"); // redirect to login page
            },
          },
        });
        break;
      case "stats":
        router.push("/stats");
        break;
    }
  };

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader size="xl" color="console.4" />
      </Center>
    );
  }

  if (!session) return null;

  return (
    <Box className={classes.dashboardPage}>
      {/* Animated background gradient */}
      <div className={classes.gradient} aria-hidden="true" />

      <Container size="xl" className={classes.container}>
        {/* Header */}
        <Box className={classes.header}>
          <Text className={classes.welcomeText}>Welcome back,</Text>
          <h1 className={classes.title}>{session.user.name}</h1>
        </Box>

        {/* Stats Grid */}
        <Box className={classes.statsGrid}>
          <Box className={classes.statCard}>
            <IconSwords size={40} className={classes.statIcon} />
            <Text className={classes.statLabel}>Games Played</Text>
            <Text className={classes.statValue}>{stats.gamesPlayed}</Text>
          </Box>

          <Box className={classes.statCard}>
            <IconTarget size={40} className={classes.statIcon} />
            <Text className={classes.statLabel}>Win Rate</Text>
            <Text className={classes.statValue}>{stats.winRate}%</Text>
          </Box>

          <Box className={classes.statCard}>
            <IconTrophy size={40} className={classes.statIcon} />
            <Text className={classes.statLabel}>Global Rank</Text>
            <Text className={classes.statValue}>#{stats.rank}</Text>
          </Box>
        </Box>

        {/* Quick Actions */}
        <Box className={classes.quickActions}>
          <Box
            className={classes.actionCard}
            onClick={() => handleQuickAction("new_game")}
          >
            <Box className={classes.actionIconWrapper}>
              <IconPlayerPlay size={32} className={classes.actionIcon} />
            </Box>
            <Text className={classes.actionTitle}>New Game</Text>
            <Text className={classes.actionDescription}>
              Jump into a quick match and test your skills
            </Text>
          </Box>

          <Box
            className={classes.actionCard}
            onClick={() => handleQuickAction("signout")}
          >
            <Box className={classes.actionIconWrapper}>
              <IconClock size={32} className={classes.actionIcon} />
            </Box>
            <Text className={classes.actionTitle}>Sign Out</Text>
            <Text className={classes.actionDescription}>
              Sign out of your account
            </Text>
          </Box>

          <Box
            className={classes.actionCard}
            onClick={() => handleQuickAction("stats")}
          >
            <Box className={classes.actionIconWrapper}>
              <IconChartLine size={32} className={classes.actionIcon} />
            </Box>
            <Text className={classes.actionTitle}>View Stats</Text>
            <Text className={classes.actionDescription}>
              Analyze your performance and progress
            </Text>
          </Box>
        </Box>

        {/* Recent Games */}
        <Box className={classes.recentGames}>
          <Box className={classes.sectionHeader}>
            <Text className={classes.sectionTitle}>Recent Games</Text>
            <Button
              variant="subtle"
              color="console.4"
              rightSection={<IconHistory size={18} />}
              onClick={() => router.push("/history")}
            >
              View All
            </Button>
          </Box>

          <Box className={classes.gamesTable}>
            <Box className={classes.tableHeader}>
              <Text>Opponent</Text>
              <Text>Result</Text>
              <Text>Score</Text>
              <Text>Time</Text>
            </Box>

            {recentGames.length > 0 ? (
              recentGames.map((game) => (
                <Box key={game.id} className={classes.tableRow}>
                  <Text fw={600}>{game.opponent}</Text>
                  <Box>
                    <span
                      className={`${classes.statusBadge} ${game.result === "win"
                          ? classes.statusWin
                          : classes.statusLoss
                        }`}
                    >
                      <span
                        className={`${classes.statusDot} ${game.result === "win"
                            ? classes.statusDotWin
                            : classes.statusDotLoss
                          }`}
                      />
                      {game.result}
                    </span>
                  </Box>
                  <Text c="dimmed">{game.score}</Text>
                  <Text c="dimmed" size="sm">
                    {game.date}
                  </Text>
                </Box>
              ))
            ) : (
              <Box className={classes.emptyState}>
                <IconChartBar size={64} className={classes.emptyStateIcon} />
                <Text className={classes.emptyStateText}>
                  No games played yet
                </Text>
                <Button
                  color="console.4"
                  leftSection={<IconPlayerPlay size={20} />}
                  onClick={() => handleQuickAction("new_game")}
                >
                  Start Your First Game
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}