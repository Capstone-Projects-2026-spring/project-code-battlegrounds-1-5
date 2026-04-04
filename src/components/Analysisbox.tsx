import { Paper, Text, Group, Box, Badge, Title, Divider, Code } from "@mantine/core";

export interface AnalysisBoxProps {
  team1Code: string;
  team2Code?: string;
}
export default function AnalysisBox({ team1Code, team2Code }: AnalysisBoxProps) {
  const hasAnyCode = Boolean(team1Code || team2Code);

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Title order={4} mb="sm" c="blue.7">Solution Analysis</Title>
        <Text size="sm" c="dimmed" lh={1.6}>
          {hasAnyCode ?'' : 'Waiting for code'}
        </Text>

        {/* Side-by-side code containers */}
        <Box style={{ marginTop: '0.75rem', flex: 1, minHeight: 0, display: 'flex', gap: '1rem' }}>
          {/* Team 1 Code */}
          {team1Code && (
            <Box style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              padding: '0.75rem'
            }}>
              <Text size="xs" fw={600} mb="xs" c="blue.6">Team 1</Text>
              <Box style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'auto',
                paddingRight: '0.25rem'
              }}>
                <Code block mt={0} ff="monospace" style={{ background: 'transparent', padding: 0 }}>
                  {team1Code}
                </Code>
              </Box>
            </Box>
          )}

          {/* Team 2 Code */}
          {team2Code && (
            <Box style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              padding: '0.75rem'
            }}>
              <Text size="xs" fw={600} mb="xs" c="blue.6">Team 2</Text>
              <Box style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'auto',
                paddingRight: '0.25rem'
              }}>
                <Code block mt={0} ff="monospace" style={{ background: 'transparent', padding: 0 }}>
                  {team2Code}
                </Code>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Divider my="md" />

      {/* Performance Metrics - Horizontal layout */}
      <Group grow align="flex-start" gap="md">
        <Box>
          <Text size="xs" fw={600} mb="xs">Team 1 Metrics</Text>
          <Group gap="xs">
            <Badge color="teal" variant="light" size="md" radius="sm">
              Runtime: A
            </Badge>
            <Badge color="yellow" variant="light" size="md" radius="sm">
              Space: B
            </Badge>
            <Badge color="orange" variant="light" size="md" radius="sm">
              Time: C
            </Badge>
          </Group>
        </Box>

        {team2Code && (
          <Box>
            <Text size="xs" fw={600} mb="xs">Team 2 Metrics</Text>
            <Group gap="xs">
              <Badge color="teal" variant="light" size="md" radius="sm">
                Runtime: A
              </Badge>
              <Badge color="yellow" variant="light" size="md" radius="sm">
                Space: B
              </Badge>
              <Badge color="orange" variant="light" size="md" radius="sm">
                Time: C
              </Badge>
            </Group>
          </Box>
        )}
      </Group>

    </Paper>
  );
}