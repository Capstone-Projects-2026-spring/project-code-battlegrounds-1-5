import React, { useState } from "react";
import {
  Stack,
  Text,
  Button,
  TextInput,
  Group,
} from "@mantine/core";

export default function PartnerSearch() {
  const [query, setQuery] = useState("");

  const handleRandom = () => {
    // replace with real random partner logic
    console.log("Pick a random partner");
  };

  const handleSearch = () => {
    // replace with real search logic
    console.log("Search partner:", query);
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
            Select a partner
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
            placeholder="Enter Partner Username"
            size="lg"
            radius="xs"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            styles={{ input: { width: 300 } }}
          />
        </Group>
      </Group>
    </Stack>
  );
}
