import { Center, Group, Text } from "@mantine/core";

interface GameStateScreenProps {
  message: string;
  roomId: string;
  testId?: string;
}

export default function GameStateScreen({
  message,
  roomId,
  testId,
}: GameStateScreenProps) {
  return (
    <Center h="100vh">
      <Group align="center">
        <Text size="xl" c="dimmed" data-testid={testId}>
          {message}
        </Text>
        <Text size="md" fw={600}>
          Room ID: {roomId}
        </Text>
      </Group>
    </Center>
  );
}
