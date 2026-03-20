import { Paper, ScrollArea, Stack, Text, Title, ActionIcon } from "@mantine/core";
import { IconEyeOff } from "@tabler/icons-react";

// Define the prop(s) for the ProblemBox component.
// onToggleVisibility is optional, and can be used to control component visibility from a parent component.
interface ProblemBoxProps {
  onToggleVisibility?: () => void;
}

export default function ProblemBox({ onToggleVisibility }: ProblemBoxProps) {
  return (
    <Paper p="md" h="100%" bg="transparent" style={{ position: 'relative' }}>
      {/* Conditionally render the "Hide" button. It will only show up if the
           onToggleVisibility function is passed in as a prop. */}
      {onToggleVisibility && (
        <ActionIcon
          variant="transparent"
          color="gray"
          onClick={onToggleVisibility}
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
          title="Hide Problem"
        >
          <IconEyeOff size={20} />
        </ActionIcon>
      )}
      <ScrollArea h="100%" offsetScrollbars>
        <Stack gap="md">
          <Title order={3} pr="xl">
            Problem Title
          </Title>
          <Text size="sm">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </Text>
          <Text size="sm">More content to ensure scrolling works correctly within the allocated vertical space...</Text>
        </Stack>
      </ScrollArea>
    </Paper>
  );
}
