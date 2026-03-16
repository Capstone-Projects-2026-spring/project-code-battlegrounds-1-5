import { Paper, Text, Group, Box, Badge, Title, Divider } from "@mantine/core";

export default function AnalysisBox() {
  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      
      <Box style={{ flex: 1 }}>
        <Title order={4} mb="sm" c="blue.7">Solution Analysis</Title>
        <Text size="sm" c="dimmed" lh={1.6}>
          Your solution effectively utilizes a hash map to achieve the desired outcome, minimizing redundant iterations. 
          However, you could optimize the space complexity by mutating the array in place if the problem constraints allow it.
          Below is a reference to an optimal approach...
        </Text>
      </Box>

      <Divider my="md" />

      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>Performance Metrics</Text>
        
        <Group gap="xs">
          <Badge color="teal" variant="light" size="lg" radius="sm">
            Runtime: A
          </Badge>
          <Badge color="yellow" variant="light" size="lg" radius="sm">
            Space: B
          </Badge>
          <Badge color="orange" variant="light" size="lg" radius="sm">
            Time: C
          </Badge>
        </Group>
      </Group>

    </Paper>
  );
}