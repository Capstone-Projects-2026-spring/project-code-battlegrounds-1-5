import { Paper, Title, Table, Text } from "@mantine/core";

// Define the structure of a test case for TypeScript
interface TestCase {
  id: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export default function TestCaseResultsBox() {
  // Mock data - in your real app, this will come from your backend via props
  const testCases: TestCase[] = [
    { id: 1, input: "[1, 2, 3, 4, 5]", expected: "3", actual: "3", passed: true },
    { id: 2, input: "[5, 6, 7, 8, 9]", expected: "7", actual: "7", passed: true },
    { id: 3, input: "[1, 2, 3, 4]", expected: "2.5", actual: "2", passed: false },
  ];

  const rows = testCases.map((element) => (
    <Table.Tr key={element.id}>
      <Table.Td>
        <Text size="sm" fw={500} ff="monospace">{element.input}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={700} c={element.passed ? "teal.6" : "red.6"} ff="monospace">
          {element.actual}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={700} c={element.passed ? "teal.6" : "red.6"} ff="monospace">
          {element.expected}
        </Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder style={{ flex: 1 }}>
      
      <Title order={4} mb="md" ta="center">Test Case Overview</Title>

      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Input</Table.Th>
            <Table.Th>Your Result</Table.Th>
            <Table.Th>Expected Result</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
      
    </Paper>
  );
}