import { Paper, Title, Table, Text, Box } from "@mantine/core";
import { useEffect, useState } from "react";

interface TestCase {
  id: string;
  input: unknown;
  expected: unknown;
}

interface TestCaseResultsBoxProps {
  gameId?: string;
  team1Results?: unknown[];
  team2Results?: unknown[];
}

export default function TestCaseResultsBox({ gameId, team1Results, team2Results }: TestCaseResultsBoxProps) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameId) return;

    const fetchTests = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/rooms/tests?gameId=${gameId}`);
        if (!response.ok) return;
        const data = (await response.json()) as { tests: TestCase[] };
        setTestCases(data.tests);
      } catch (error) {
        console.error("Failed to fetch tests", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, [gameId]);

  interface Parameter {
    name: string;
    type: string;
    value: unknown;
    isOutputParameter?: boolean;
  }

  const formatValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
      // Check if it's a parameter array
      if (value.length > 0 && typeof value[0] === 'object' && 'name' in value[0]) {
        const params = value as Parameter[];
        return params
          .filter(p => !p.isOutputParameter)
          .map(p => `${p.name}: ${p.value}`)
          .join(', ');
      }
      return JSON.stringify(value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const rows = testCases.map((element, index) => (
    <Table.Tr key={element.id}>
      <Table.Td>
        <Text size="sm" fw={500} ff="monospace">{formatValue(element.input)}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500} ff="monospace">{team1Results && team1Results[index] !== undefined ? formatValue(team1Results[index]) : '-'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500} ff="monospace">{team2Results && team2Results[index] !== undefined ? formatValue(team2Results[index]) : '-'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500} ff="monospace">{formatValue(element.expected)}</Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Title order={4} mb="md" ta="center">Test Cases</Title>

      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Table highlightOnHover verticalSpacing="sm" striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Input</Table.Th>
              <Table.Th>Your Result</Table.Th>
              <Table.Th>Other Team</Table.Th>
              <Table.Th>Expected Result</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{loading ? null : rows}</Table.Tbody>
        </Table>
      </Box>
    </Paper>
  );
}