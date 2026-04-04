import { authClient } from "@/lib/auth-client";
import {
  Button,
  Card,
  Container,
  Flex,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { GameType } from "@prisma/client";
import { useRouter } from "next/router";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";

type DifficultyType = "EASY" | "MEDIUM" | "HARD";

interface Difficulty {
  title: string,
  subtitle: string;
  topics: string[],
  color: string,
  difficulty: DifficultyType
}
const difficulties: Difficulty[] = [
  {
    title: "Easy Difficulty",
    subtitle: "For Beginners",
    topics: ["You're just starting to learn how to code, you're gaining knowledge"],
    color: "#40c057",
    difficulty: "EASY"
  },
  {
    title: "Medium Difficulty",
    subtitle: "For Intermediate Programmers",
    topics: ["You have more experience, you're ready for a bit of a challenge"],
    color: "#fbb800",
    difficulty: "MEDIUM"
  },
  {
    title: "Hard Difficulty",
    subtitle: "For Advanced Programmers",
    topics: ["You're a pro, ready to take on the hardest problems we have"],
    color: "#fa5252",
    difficulty: "HARD"
  }
];

export default function Subgrid() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();

  const handleCreateRoom = async (difficulty: DifficultyType, gameType: GameType) => {
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
      <Stack gap="md">
        <Title ta="center">Select your battleground...</Title>
        {difficulties.map((diff) => {
          return (
            <div key={diff.difficulty}>
              <Card
                p={"xl"}
                withBorder
                bg={`linear-gradient(to right,
                    ${diff.color} 31%, 
                    rgba(0, 0, 0, 0) 31%
                    )`}
              >
                <Flex
                  direction="row"
                  align={"center"}
                  gap="md"
                  style={{ height: "100%" }}
                >
                  <Flex direction={"column"} style={{ flex: '0 0 300px' }}>
                    <Title
                      order={2}
                      fw={500}
                      c="white"
                    >
                      {diff.title}
                    </Title>

                    <Text c="white" size="md">
                      {diff.subtitle}
                    </Text>
                  </Flex>

                  <Flex
                    direction="column"
                    style={{ flex: '0 0 200px' }}
                  >
                    {diff.topics.map((topic, index) => (
                      <Text key={index}>
                        {topic}
                      </Text>
                    ))}
                  </Flex>

                  <Flex
                    ml="auto"
                    direction={"row"}
                    align="center"
                    gap={5}
                  >
                    <Button
                      disabled={loading}
                      loading={loading}
                      size="md"
                      data-testid={`co-op-create-room-button-${diff.difficulty.toLowerCase()}`}
                      onClick={() => handleCreateRoom(diff.difficulty, GameType.TWOPLAYER)}
                      color={diff.color}
                    >
                      Start Co-Op
                    </Button>

                    <Button
                      disabled={loading}
                      loading={loading}
                      size="md"
                      data-testid={`2v2-create-room-button-${diff.difficulty.toLowerCase()}`}
                      onClick={() => handleCreateRoom(diff.difficulty, GameType.FOURPLAYER)}
                      color={diff.color}
                      variant="outline"
                    >
                      Start 2v2
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            </div>
          );
        })}
      </Stack>
    </Container>
  );
}
