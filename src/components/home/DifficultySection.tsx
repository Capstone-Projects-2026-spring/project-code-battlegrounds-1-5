import { Container, Title, Text, Stack, Button, Group, Box, Badge, Card } from "@mantine/core";
import { IconUsers, IconUser } from "@tabler/icons-react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { usePostHog } from "posthog-js/react";
import { GameType } from "@prisma/client";
import { notifications } from "@mantine/notifications";
import { useCreateRoom } from "@/hooks/useCreateRoom";
import classes from "@/styles/comps/DifficultySection.module.css";

type DifficultyType = "EASY" | "MEDIUM" | "HARD";

interface Difficulty {
  level: DifficultyType;
  title: string;
  subtitle: string;
  description: string;
  topics: string[];
  color: string;
  estimatedTime: string;
}

const difficulties: Difficulty[] = [
  {
    level: "EASY",
    title: "Beginner",
    subtitle: "New to pair programming?",
    description: "Perfect for learning the fundamentals of collaborative coding",
    topics: ["Basic algorithms", "Simple data structures", "Code review basics"],
    color: "green",
    estimatedTime: "5-10 min",
  },
  {
    level: "MEDIUM",
    title: "Intermediate",
    subtitle: "Ready for a challenge?",
    description: "Test your collaboration skills with moderate complexity",
    topics: ["Advanced algorithms", "Testing strategies", "Code optimization"],
    color: "yellow",
    estimatedTime: "10-15 min",
  },
  {
    level: "HARD",
    title: "Advanced",
    subtitle: "For experienced programmers",
    description: "Master-level problems requiring deep collaboration",
    topics: ["Complex algorithms", "System design", "Performance tuning"],
    color: "red",
    estimatedTime: "15-20 min",
  },
];

export default function DifficultySection() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();
  const { createRoom, isLoading } = useCreateRoom();

  const handleCreateRoom = async (difficulty: DifficultyType, gameType: GameType) => {
    if (!session) {
      posthog?.capture("difficulty_selected_not_authenticated", { difficulty, gameType });
      notifications.show({
        title: "Authentication Required",
        message: "Please sign in to start a match",
        color: "blue",
      });
      router.push("/login?redirect=/");
      return;
    }

    posthog?.capture("room_creation_started", { difficulty, gameType });

    const result = await createRoom(difficulty, gameType);
    
    if (result.success && result.gameId) {
      router.push(`/game/${result.gameId}`);
    } else {
      notifications.show({
        title: "Failed to create room",
        message: result.error || "Please try again",
        color: "red",
      });
    }
  };

  return (
    <Box 
      component="section" 
      py={80} 
      className={classes.section}
      aria-labelledby="difficulty-section-title"
    >
      <Container size="lg">
        <Stack gap="xl" align="center" mb={60}>
          <Title 
            id="difficulty-section-title"
            order={2} 
            ta="center"
            className={classes.sectionTitle}
          >
            Choose Your Challenge
          </Title>
          <Text size="lg" c="dimmed" ta="center" maw={600}>
            Select a difficulty level that matches your skill. Each level offers unique learning opportunities.
          </Text>
        </Stack>

        <Stack gap="md">
          {difficulties.map((diff) => (
            <Card
              key={diff.level}
              padding="xl"
              radius="md"
              className={classes.difficultyCard}
              withBorder
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                {/* Left: Info */}
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb="xs">
                    <Badge 
                      color={diff.color} 
                      variant="light" 
                      size="lg"
                      radius="sm"
                    >
                      {diff.title}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {diff.estimatedTime}
                    </Text>
                  </Group>
                  
                  <Text fw={600} size="lg" mb={4}>
                    {diff.subtitle}
                  </Text>
                  
                  <Text c="dimmed" size="sm" mb="md">
                    {diff.description}
                  </Text>

                  <Group gap="xs">
                    {diff.topics.map((topic, idx) => (
                      <Badge 
                        key={idx} 
                        variant="dot" 
                        color="gray"
                        size="sm"
                      >
                        {topic}
                      </Badge>
                    ))}
                  </Group>
                </Box>

                {/* Right: Actions */}
                <Group gap="xs" wrap="nowrap">
                  <Button
                    size="md"
                    color={diff.color}
                    leftSection={<IconUser size={18} />}
                    onClick={() => handleCreateRoom(diff.level, GameType.TWOPLAYER)}
                    loading={isLoading}
                    data-testid={`co-op-create-room-button-${diff.level.toLowerCase()}`}
                    className={classes.actionButton}
                  >
                    Co-Op
                  </Button>

                  <Button
                    size="md"
                    color={diff.color}
                    variant="outline"
                    leftSection={<IconUsers size={18} />}
                    onClick={() => handleCreateRoom(diff.level, GameType.FOURPLAYER)}
                    loading={isLoading}
                    data-testid={`2v2-create-room-button-${diff.level.toLowerCase()}`}
                    className={classes.actionButton}
                  >
                    2v2
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
