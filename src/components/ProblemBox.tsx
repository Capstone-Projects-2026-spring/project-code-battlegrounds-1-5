import { Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";

export default function ProblemBox() {
  return (
    // Remove shadow and use h="100%" to fill the parent Box
    <Paper p="md" h="100%" bg="transparent">
      {/* Remove the width: "20%" here! Let the parent handle width. */}
      <ScrollArea h="100%" offsetScrollbars>
        <Stack gap="md">
          <Title order={3}>Two Sum</Title>
          <Text size="sm">
            Given an array of integers nums¬¨‚Ä†and an integer target, return
            indices of the two numbers such that they add up to target. You may
            assume that each input would have exactly one solution, and you may
            not use the same element twice. You can return the answer in any
            order.
          </Text>
          <Text size="sm">
            {/* Add enough text here to test the scroll */}
            Array,Hash Table
          </Text>
        </Stack>
      </ScrollArea>
    </Paper>
  );
}
