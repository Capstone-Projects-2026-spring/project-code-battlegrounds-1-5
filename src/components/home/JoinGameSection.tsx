import { useState } from "react";
import { TextInput, Button, Group, Text, Box, Card, Stack } from "@mantine/core";
import { IconSearch, IconArrowRight } from "@tabler/icons-react";
import { useRouter } from "next/router";
import { usePostHog } from "posthog-js/react";
import Link from "next/link";
import classes from "@/styles/comps/JoinGameSection.module.css";

export default function JoinGameSection() {
  const [gameId, setGameId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const posthog = usePostHog();

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    
    const trimmedId = gameId.trim();
    
    if (!trimmedId) {
      setError("Please enter a Game ID");
      return;
    }

    // Basic UUID validation (optional but good UX)
    // const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // if (!uuidRegex.test(trimmedId)) {
    //   setError("Invalid Game ID format");
    //   return;
    // }

    setError("");
    posthog?.capture("room_joined_by_id", { roomId: trimmedId });
    router.push(`/game/${trimmedId}`);
  };

  return (
    <Card 
      padding="xl" 
      radius="md" 
      withBorder
      className={classes.card}
    >
      <Stack gap="lg">
        <Box>
          <Group gap="xs" mb="xs">
            <IconSearch size={20} />
            <Text fw={600} size="lg">
              Join a Private Game
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            Have a Game ID from a friend? Enter it below to join their match.
          </Text>
        </Box>

        <form onSubmit={handleSubmit}>
          <Group gap="md" align="flex-start">
            <TextInput
              placeholder="Enter Game ID (e.g., 550e8400)"
              size="md"
              value={gameId}
              onChange={(e) => {
                setGameId(e.currentTarget.value);
                setError("");
              }}
              error={error}
              style={{ flex: 1 }}
              styles={{ input: { fontFamily: "monospace" } }}
              aria-label="Game ID input"
            />
            <Button
              type="submit"
              size="md"
              rightSection={<IconArrowRight size={18} />}
              disabled={!gameId.trim()}
            >
              Join Game
            </Button>
          </Group>
        </form>

        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Looking for a match?
          </Text>
          <Button
            component={Link}
            href="/matchmaking"
            variant="subtle"
            size="sm"
            data-testid="matchmaking-link"
          >
            Try Quick Matchmaking
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
