import {
  Container,
  Grid,
  Skeleton,
  Text,
  Card,
  Box,
  Flex,
  Button,
} from "@mantine/core";
import { useState } from "react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { usePostHog } from "posthog-js/react";

type Difficulty = "EASY" | "MEDIUM" | "HARD";

export default function Subgrid() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();
  const handleCreateRoom = async (difficulty: Difficulty) => {
    
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
        body: JSON.stringify({ difficulty }),
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
        <Grid.Col span={4}>
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
                  bg="green.6"
                  style={{
                    borderRadius: "50%",
                    marginBottom: 12,
                  }}
                />
                <Text fw={500}>Easy Difficulty</Text>
                <Text size="sm" c="dimmed">
                  For Beginners
                </Text>
                <Text size="sm" c="dimmed">
                  Arrays
                </Text>
                <Text size="sm" c="dimmed">
                  Strings
                </Text>

                <Button onClick={() => handleCreateRoom("EASY")} mt={"auto"}>
                  Create Room
                </Button>
              </Flex>
            </Card>
          )}
        </Grid.Col>

        <Grid.Col span={4}>
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
                  bg="orange.6"
                  style={{
                    borderRadius: "50%",
                    marginBottom: 12,
                  }}
                />
                <Text fw={500}>Medium Difficulty</Text>
                <Text size="sm" c="dimmed">
                  For Intermediate Programmers
                </Text>
                <Text size="sm" c="dimmed">
                  Math Questions
                </Text>
                <Text size="sm" c="dimmed">
                  Hash Maps
                </Text>
                <Text size="sm" c="dimmed">
                  Sorts
                </Text>

                <Button onClick={() => handleCreateRoom("MEDIUM")} mt={"auto"}>
                  Create Room
                </Button>
              </Flex>
            </Card>
          )}
        </Grid.Col>

        <Grid.Col span={4}>
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
                  bg="red.6"
                  style={{
                    borderRadius: "50%",
                    marginBottom: 12,
                  }}
                />
                <Text fw={500}>Hard Difficulty</Text>
                <Text size="sm" c="dimmed">
                  For Advanced Programmers
                </Text>
                <Text size="sm" c="dimmed">
                  Data Structures And Algorithms
                </Text>
                <Text size="sm" c="dimmed">
                  Trees
                </Text>
                <Text size="sm" c="dimmed">
                  Graphs
                </Text>
                <Text size="sm" c="dimmed">
                  Dynamic Programming
                </Text>
                <Button onClick={() => handleCreateRoom("HARD")} mt={"auto"}>
                  Create Room
                </Button>
              </Flex>
            </Card>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
}

