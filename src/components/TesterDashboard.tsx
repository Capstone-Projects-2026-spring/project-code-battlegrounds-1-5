import { Stack, Button, Text, Paper, Title } from '@mantine/core';

interface TesterDashboardProps {
  isSpectator?: boolean;
}

export default function TesterDashboard({ isSpectator = false }: TesterDashboardProps) {
  const actions = [
    "Send Edge Case",
    "Check Tests now",
    "Check Error",
    "What are we focusing on now?",
  ];

  return (
    <Paper 
      p="md" 
      bg="#9f6c6c" 
      radius="xs" 
      h="100%"
    >
      <Stack gap="xs">
        <Title order={4} c="white" fw={700} lh={1.2}>
          Tester Dashboard:
        </Title>
        <Text c="white" size="sm" fw={500} mb="xs">
          Can only communicate with quality using buttons:
        </Text>

        <Stack gap={8}>
          {actions.map((label) => (
            <Button
              key={label}
              fullWidth
              variant="filled"
              color="#4A99B8" 
              styles={{
                root: {
                  border: '1px solid black',
                  height: '42px',
                },
                label: {
                  color: 'black',
                  fontWeight: 700,
                  fontSize: '15px',
                },
              }}
              disabled={isSpectator}
              onClick={() => console.log(`Action triggered: ${label}`)}
            >
              {label}
            </Button>
          ))}
        </Stack>
        {isSpectator && (
          <Text c="yellow" size="xs" mt="sm">
            Spectators cannot trigger tester actions.
          </Text>
        )}
      </Stack>
    </Paper>
  );
};