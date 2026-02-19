import { Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";

export default function ProblemBox() {
  return (
    // Remove shadow and use h="100%" to fill the parent Box
    <Paper p="md" h="100%" bg="transparent">
        {/* Remove the width: "20%" here! Let the parent handle width. */}
        <ScrollArea h="100%" offsetScrollbars>
            <Stack gap="md">
                <Title order={3}>
                    Problem Title
                </Title>
                <Text size="sm">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do 
                    eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                    Ut enim ad minim veniam, quis nostrud exercitation ullamco 
                    laboris nisi ut aliquip ex ea commodo consequat.
                </Text>
                <Text size="sm">
                    {/* Add enough text here to test the scroll */}
                    More content to ensure scrolling works correctly within the 
                    allocated vertical space...
                </Text>
            </Stack>
        </ScrollArea>
    </Paper>
  );
}
