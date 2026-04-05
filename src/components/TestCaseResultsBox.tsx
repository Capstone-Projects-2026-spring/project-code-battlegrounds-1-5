import { Paper, Title, Table, Text } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import styles from '@/styles/comps/TestCaseResultsBox.module.css';

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
    { id: 1, input: "1 2 1 4 5 6", expected: "1 1 2 4 5 6", actual: "1 2 1 4 5 6", passed: true },
    { id: 2, input: "1 1 1 1 h 5", expected: "1 1 1 1 5", actual: "Error", passed: false },
    { id: 3, input: "3 2 1", expected: "1 2 3", actual: "1 2 3", passed: true },
  ];

  const rows = testCases.map((element) => (
    <Table.Tr key={element.id} className={styles.tableRow}>
      <Table.Td>
        <Text className={styles.cellInput}>{element.input}</Text>
      </Table.Td>
      <Table.Td>
        <div className={styles.cellResult}>
          <span className={element.passed ? styles.statusPass : styles.statusFail}>
            {element.passed ? <IconCheck size={14} /> : <IconX size={14} />}
          </span>
          <Text className={element.passed ? styles.passText : styles.failText}>
            {element.actual}
          </Text>
        </div>
      </Table.Td>
      <Table.Td>
        <Text className={element.passed ? styles.passText : styles.failText}>
          {element.expected}
        </Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder className={styles.container}>
      
      <Title order={4} mb="md" className={styles.title}>Test Case Overview</Title>

      <Table highlightOnHover verticalSpacing="sm" className={styles.table}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th className={styles.tableHeader}>Input</Table.Th>
            <Table.Th className={styles.tableHeader}>Your Result</Table.Th>
            <Table.Th className={styles.tableHeader}>Expected Result</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
      
    </Paper>
  );
}