import { Button, Container, Divider, Group, Stack, TextInput, Title } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";

export default function PartnerSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const posthog = usePostHog();

  const handleSearch = (e: React.SubmitEvent) => {
    e.preventDefault();
    // Using the input query, implement logic to search for a partner by room ID.
    console.log("Search room ID:", query);
    const roomId = query.trim();
    if (!roomId) return;

    posthog.capture("room_joined_by_id", {
      roomId: roomId
    });
    router.push(`/game/${roomId}`);
  };

  return (
    <Container py="lg">
      <Stack h="40vh">
        <Title order={3}>
          Have a Game ID?
        </Title>
        <Group
          justify="space-between"
          // align="center"
          maw={1100}
          mx="auto"
          w="100%"
        >
          {/* Right Side: Controls */}
          <Group gap="md">
            <form onSubmit={handleSearch}>
              <Group gap="md" align="center">
                <TextInput
                  placeholder="Enter Game ID..."
                  size="lg"
                  radius="xs"
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                  styles={{ input: { width: 300 } }}
                />
                <Button
                  rightSection={<IconArrowRight />}
                  size="lg"
                  type="submit"
                  radius="xs"
                >
                  Find
                </Button>
              </Group>
            </form>

            <Divider orientation="vertical" />

            <Button
              component={Link}
              href="/matchmaking"
              data-testid="matchmaking-link"
              size="lg"
              color="black"
              radius="xs"
              px={40}
            >
              Matchmaking
            </Button>
          </Group>
        </Group>
      </Stack>
    </Container>
  );
}