import {
  Container,
  Grid,
  Skeleton,
  Text,
  Card,
  Box,
  Flex,
  Button,
  SegmentedControl
} from "@mantine/core";
import { useState } from "react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { useToggle } from "@mantine/hooks";
import { GameType } from "@prisma/client";
import { usePostHog } from "posthog-js/react";

type DifficultyType = "EASY" | "MEDIUM" | "HARD";

interface Difficulty {
  title: string,
  description: string,
  color: string,
  difficulty: DifficultyType
}
const difficulties: Difficulty[] = [
  {
    title: "Easy Difficulty",
    description: `For beginners\nArrays\nStrings`,
    color: "green.6",
    difficulty: "EASY"
  },
  {
    title: "Medium Difficulty",
    description: `For intermediate programmers\nMath questions\nHash maps\nSorting`,
    color: "orange.6",
    difficulty: "MEDIUM"
  },
  {
    title: "Hard Difficulty",
    description: `For advanced programmers\nData Structures & Algorithms\nTrees\nGraphs\nDynamic Programming`,
    color: "red.6",
    difficulty: "HARD"
  }
];

export default function Subgrid() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameType, toggleGameType] = useToggle<GameType>([GameType.TWOPLAYER, GameType.FOURPLAYER]);

  const router = useRouter();
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();
  const handleCreateRoom = async (difficulty: DifficultyType) => {
    if (!session) {
      setError("Error: You must be signed in to create a match!");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ difficulty, gameType }),
      });
      const data = await response.json();
      if (response.ok) {
        posthog.capture("room_created", {
          difficulty: difficulty,
        });
        router.push(`/game/${data.gameId}`); // Redirect to the new game room page using the returned gameId
      } else {
        alert(data.message || "Failed to create game room"); // Show error message from the server if available, otherwise show a generic error message
      }
    } catch (error) {
      alert("Failed to create game room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container my="md">
      <Grid>
        {difficulties.map((difficulty) => {
          const descriptionLines = difficulty.description.split('\n');
          return (
            <Grid.Col key={difficulty.difficulty} span={4}>
              {loading ? (
                <Skeleton height={360} radius="md" />
              ) : (
                <Card radius="md" h={360} withBorder>
                  <Flex
                    direction="column"
                    align={"center"}
                    justify={"center"}
                    style={{ height: "100%" }}
                  >
                    <Box
                      w={48}
                      h={48}
                      bg={difficulty.color}
                      style={{
                        borderRadius: "50%",
                        marginBottom: 12,
                      }}
                    />
                    <Text fw={500}>{difficulty.title}</Text>
                    {descriptionLines.map((line, index) => (
                      <Text key={index} size="sm" c="dimmed">
                        {line}
                      </Text>
                    ))}

                    <Button
                      data-testid={`create-room-button-${difficulty.difficulty.toLowerCase()}`}
                      onClick={() => handleCreateRoom(difficulty.difficulty)}
                      mt={"auto"}
                    >
                      Create Room
                    </Button>
                  </Flex>
                </Card>
              )}
            </Grid.Col>
          );
        })}
      </Grid>

      <SegmentedControl
        data-testid="gameType-toggle"
        value={gameType}
        onChange={() => toggleGameType()}
        data={[
          { label: "2 Player", value: GameType.TWOPLAYER },
          { label: "4 Player", value: GameType.FOURPLAYER },
        ]}
        mt="md"
      />
    </Container>
  );
}

