import React, { useState } from "react";
import { Stack, Text, Button, TextInput, Group } from "@mantine/core";
import { useRouter } from "next/router";

export default function PartnerSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleRandom = () => {
    // replace with real random partner logic
    console.log("Pick a random partner");
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(); // Trigger search on Enter key press
    }
  };

  const handleSearch = () => {
    //Using the input query, implement logic to search for a partner by room ID.
    console.log("Search room ID:", query);
    const roomId = query.trim();
    if (!roomId) return;

    router.push(`/playGame/${roomId}`);
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
          <Button
            size="lg"
            color="black"
            onClick={handleRandom}
            radius="xs"
            px={40}
          >
            Random
          </Button>

          <TextInput
            placeholder="Enter Room ID"
            size="lg"
            radius="xs"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            styles={{ input: { width: 300 } }}
          />
        </Group>
      </Group>
    </Stack>
  );
}
