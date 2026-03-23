import { Paper, Text, Group, Box, Badge, Title, Divider } from "@mantine/core";
import type { TeamCount } from "@/components/TeamSelect";

interface AnalysisProps {
  teamSelected: string;
  teams: TeamCount[];
}

export default function AnalysisBox({ teamSelected, teams }: AnalysisProps) {
  const isTeamOne = teams[0]?.teamId === teamSelected;

  const analysis = isTeamOne
    ? {
      text: `Your solution correctly identifies the upper median by using Math.floor(length / 2) as the index. 
             For odd-length arrays this returns the true middle element, and for even-length arrays it returns 
             the upper of the two middle elements as required. This is a clean O(1) solution with no extra space needed.`,
      runtime: { grade: "A", color: "teal" },
      space: { grade: "A", color: "teal" },
      time: { grade: "A", color: "teal" },
    }
    : {
      text: `Your solution attempts to average the two middle elements for even-length arrays, which would be correct 
             for a standard median problem. However, this problem specifically requires returning the upper of the two 
             middle elements rather than their average. For [1,2,3,4] your solution returns 2.5 but the expected 
             answer is 3.`,
      runtime: { grade: "B", color: "yellow" },
      space: { grade: "A", color: "teal" },
      time: { grade: "B", color: "yellow" },
    };
  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

      <Box style={{ flex: 1 }}>
        <Title order={4} mb="sm" c="blue.7">Solution Analysis</Title>
        <Text size="sm" c="dimmed" lh={1.6}>
          {analysis.text}
        </Text>
      </Box>

      <Divider my="md" />

      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>Performance Metrics</Text>

        <Group gap="xs">
          <Badge color={analysis.runtime.color} variant="light" size="lg" radius="sm">
            Runtime: {analysis.runtime.grade}
          </Badge>
          <Badge color={analysis.space.color} variant="light" size="lg" radius="sm">
            Space: {analysis.space.grade}
          </Badge>
          <Badge color={analysis.time.color} variant="light" size="lg" radius="sm">
            Time: {analysis.time.grade}
          </Badge>
        </Group>
      </Group>

    </Paper>
  );
}