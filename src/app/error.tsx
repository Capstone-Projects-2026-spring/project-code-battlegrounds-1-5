"use client";

import React from "react";
import { Button, Center, Stack, Text } from "@mantine/core";

interface ErrorProps {
  error: Error;
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  const isChunkError = (err: unknown) => {
    try {
      const e = err as Error;
      return /chunk|Loading chunk/i.test(e.message);
    } catch {
      return false;
    }
  };

  return (
    <Center style={{ height: "100vh" }}>
      <Stack align="center">
        <Text size="xl" weight={700} color="red">Runtime error</Text>
        <Text color="dimmed">{isChunkError(error) ? "A required code chunk failed to load." : error?.message}</Text>
        <Button
          onClick={() => {
            // Try soft-reset first (Next's error boundary reset), then hard reload
            try {
              reset();
            } catch {
              // ignore
            }
            window.location.reload();
          }}
        >
          Reload page
        </Button>
      </Stack>
    </Center>
  );
}
