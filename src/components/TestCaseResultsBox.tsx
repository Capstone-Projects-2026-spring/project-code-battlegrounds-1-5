import { Paper, Title, Table, Text, Box } from "@mantine/core";
import { useEffect, useState } from "react";
import { ParameterType } from "@/lib/ProblemInputOutput";

interface TestCase {
  id: string;
  input: ParameterType[];
  expected: ParameterType[];
}

interface TestCaseResultsBoxProps {
  gameId?: string;
  team1Results?: unknown[];
  team2Results?: unknown[];
  showOtherTeamColumn?: boolean;
  gameType?: "TWOPLAYER" | "FOURPLAYER";
  userTeamNumber?: 1 | 2;
}

export default function TestCaseResultsBox({ gameId, team1Results, team2Results, showOtherTeamColumn = true, gameType = "FOURPLAYER", userTeamNumber = 1 }: TestCaseResultsBoxProps) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);

  //const team1TestResults = team1Results || ["[1,2]", "[1,2,3]", "[1,2,3,4,5]"];
  //const team2TestResults = team2Results || ["[1,2,2]", "[1,2,2,3]", "[1,2,2,3,4,5]"];
  const team1TestResults = team1Results;
  const team2TestResults = team2Results;

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


  const formatValue = (value: ParameterType[] | unknown): string => {
    if (value === undefined || value === null) return '-';

    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
      // Check if it's a parameter array
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'value' in value[0]) {
        const params = value as ParameterType[];
        return params
          .map(p => `${p.name}: ${p.value || ''}`)
          .join(', ');
      }
      return JSON.stringify(value);
    }

    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const rows = testCases.map((element, index) => {
    // Determine which results to show based on user's team
    const yourResults = userTeamNumber === 2 ? team2TestResults : team1TestResults;
    const otherTeamResults = userTeamNumber === 2 ? team1TestResults : team2TestResults;

    return (
      <Table.Tr key={element.id}>
        <Table.Td>
          <Text size="sm" fw={500} ff="monospace">{formatValue(element.input)}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={500} ff="monospace">{yourResults && yourResults[index] !== undefined ? formatValue(yourResults[index]) : '-'}</Text>
        </Table.Td>
        {showOtherTeamColumn && (
          <Table.Td>
            <Text size="sm" fw={500} ff="monospace">{otherTeamResults && otherTeamResults[index] !== undefined ? formatValue(otherTeamResults[index]) : '-'}</Text>
          </Table.Td>
        )}
        <Table.Td>
          <Text size="sm" fw={500} ff="monospace">{formatValue(element.expected)}</Text>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Title order={4} mb="md" ta="center">Test Cases</Title>

      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Table highlightOnHover verticalSpacing="sm" striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Input</Table.Th>
              <Table.Th>{gameType === "TWOPLAYER" ? "Your Code" : "Your Result"}</Table.Th>
              {showOtherTeamColumn && <Table.Th>Other Team</Table.Th>}
              <Table.Th>Expected Result</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{loading ? null : rows}</Table.Tbody>
        </Table>
      </Box>
    </Paper>
  );
}