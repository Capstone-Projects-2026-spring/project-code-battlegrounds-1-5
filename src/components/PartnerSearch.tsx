import React, { useState } from "react";
import { Stack, Text, Button, TextInput, Group, Divider } from "@mantine/core";
import { useRouter } from "next/router";
import { IconArrowRight } from "@tabler/icons-react";
import { usePostHog } from "posthog-js/react";

export default function PartnerSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const posthog = usePostHog();

  const handleRandom = () => {
    posthog.capture("random_match_initiated");
    // replace with real random partner logic
    console.log("Pick a random partner");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    //Using the input query, implement logic to search for a partner by room ID.
    console.log("Search room ID:", query);
    const roomId = query.trim();
    if (!roomId) return;

    posthog.capture("room_joined_by_id", {
      roomId: roomId
    });
    router.push(`/game/${roomId}`);
  };

  return (
    <Stack h="40vh" justify="center" px="xl">
      <Group
        justify="space-between"
        align="center"
        maw={1100}
        mx="auto"
        w="100%"
      >
        {/* Left Side: Text */}
        <Stack gap={0} style={{ flex: 1 }}>
          <Text size="2.5rem" fw={700} style={{ lineHeight: 1.1 }}>
            Select your battleground...
          </Text>
          <Text size="xl" c="dimmed">
            Or gamble if you are bold...
          </Text>
        </Stack>

        {/* Right Side: Controls */}
        <Group gap="md" align="center">
          <form onSubmit={handleSearch}>
            <Group gap="md" align="center">
              <TextInput
                placeholder="Enter Room ID"
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
            size="lg"
            color="black"
            onClick={handleRandom}
            radius="xs"
            px={40}
          >
            Random
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}