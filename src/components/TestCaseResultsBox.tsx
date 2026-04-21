import { Paper, Title, Table, Text, Box, Badge, Tooltip } from "@mantine/core";
import { useEffect, useState, useMemo } from "react";
import { ParameterType, ParameterPrimitiveType } from "@/lib/ProblemInputOutput";
import { IconCheck, IconX } from "@tabler/icons-react";
import deepEqual from "@/util/deepEqual";
import styles from '@/styles/comps/TestCaseResultsBox.module.css';

export interface TestResultsSummary {
  yourPassedCount: number;
  otherTeamPassedCount: number;
  totalTests: number;
}

interface TestCase {
  id: string;
  input: ParameterType[];
  expected: ParameterType[];
}

interface TestCaseResultsBoxProps {
  tests?: Array<{ id: string; input: unknown; expected: unknown }>;
  team1Results?: unknown[];
  team2Results?: unknown[];
  team1Errors?: (string | null)[];
  team2Errors?: (string | null)[];
  showOtherTeamColumn?: boolean;
  gameType?: "TWOPLAYER" | "FOURPLAYER";
  userTeamNumber?: 1 | 2;
  onSummaryChange?: (summary: TestResultsSummary) => void;
}

// Convert API TestCase (with unknown types) to typed TestCase
function convertTestCases(tests: Array<{ id: string; input: unknown; expected: unknown }> | undefined): TestCase[] {
  if (!Array.isArray(tests)) return [];

  return tests.map((test) => ({
    id: test.id,
    input: Array.isArray(test.input) ? test.input : [],
    expected: Array.isArray(test.expected) ? test.expected : [],
  }));
}

function parseValueByType(value: unknown, type: ParameterPrimitiveType): unknown {
  if (value === null || value === undefined) return value;

  if (type === "boolean") {
    return typeof value === "boolean" ? value : value === "true";
  } else if (type === "number") {
    return typeof value === "number" ? value : Number(value);
  } else if (type.includes("array")) {
    if (typeof value === "string") {
      try {
        // Normalize single quotes to double quotes for JSON parsing
        let normalized = value.replace(/'/g, '"');
        // If it doesn't start with [ or ", wrap it in brackets
        if (!normalized.startsWith('[') && !normalized.startsWith('"')) {
          normalized = `[${normalized}]`;
        }
        return JSON.parse(normalized);
      } catch {
        // If JSON parsing fails, log and return null to indicate invalid format
        console.warn(`Failed to parse array value: ${value}`);
        return null;
      }
    }
    return value;
  }
  return value;
}

function extractAndCompare(actual: unknown, expected: ParameterType[]): boolean {
  if (!expected || expected.length === 0) return false;
  if (actual === null || actual === undefined) return false;

  // If actual is a ParameterType array, extract the value from it
  let actualValue: unknown = actual;
  if (Array.isArray(actual) && actual.length > 0 && typeof actual[0] === 'object' && 'value' in actual[0]) {
    actualValue = (actual as ParameterType[])[0].value;
  }

  const expectedParam = expected[0];
  const type = expectedParam.type as ParameterPrimitiveType;

  try {
    const parsedExpected = parseValueByType(expectedParam.value, type);
    const parsedActual = parseValueByType(actualValue, type);

    return deepEqual(
      parsedActual as string | number | boolean | string[] | number[] | string[][] | number[][],
      parsedExpected as string | number | boolean | string[] | number[] | string[][] | number[][]
    );
  } catch (e) {
    console.error("Error in extractAndCompare:", { actualValue, expectedValue: expectedParam.value, type, error: e });
    return false;
  }
}

export default function TestCaseResultsBox({ tests, team1Results, team2Results, team1Errors, team2Errors, showOtherTeamColumn = true, gameType = "FOURPLAYER", userTeamNumber = 1, onSummaryChange }: TestCaseResultsBoxProps) {
  // Convert and validate test cases from API
  const convertedTests = useMemo(() => convertTestCases(tests), [tests]);

  const team1TestResults = team1Results ?? [];
  const team2TestResults = team2Results ?? [];
  const team1ErrorsArray = team1Errors ?? [];
  const team2ErrorsArray = team2Errors ?? [];

  // Notify parent of summary when tests are available
  useEffect(() => {
    if (!onSummaryChange || !convertedTests || convertedTests.length === 0) return;

    // Calculate passed counts using deepEqual
    let team1PassedCount = 0;
    let team2PassedCount = 0;

    convertedTests.forEach((testCase, index) => {
      const team1Result = team1TestResults?.[index];
      const team2Result = team2TestResults?.[index];

      if (team1Result !== undefined && extractAndCompare(team1Result, testCase.expected)) {
        team1PassedCount++;
      }
      if (team2Result !== undefined && extractAndCompare(team2Result, testCase.expected)) {
        team2PassedCount++;
      }
    });

    onSummaryChange({
      yourPassedCount: userTeamNumber === 2 ? team2PassedCount : team1PassedCount,
      otherTeamPassedCount: userTeamNumber === 2 ? team1PassedCount : team2PassedCount,
      totalTests: convertedTests.length,
    });
  }, [convertedTests, onSummaryChange, userTeamNumber, team1TestResults, team2TestResults]);


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

  const formatStderr = (stderr: string): string => {
    if (!stderr) return stderr;
    return stderr
      .replace(/\/tmp\/\S+(?=\s|$)/g, "function solution.js")
      .replace(/\(node:internal\/module[\s\S]*$/, "")
      .trim();
  };

  const rows = convertedTests?.map((element, index) => {
    // Determine which results to show based on user's team
    const yourResults = userTeamNumber === 2 ? team2TestResults : team1TestResults;
    const otherTeamResults = userTeamNumber === 2 ? team1TestResults : team2TestResults;
    const yourErrors = userTeamNumber === 2 ? team2ErrorsArray : team1ErrorsArray;
    const otherTeamErrors = userTeamNumber === 2 ? team1ErrorsArray : team2ErrorsArray;

    const yourResult = yourResults?.[index];
    const otherTeamResult = otherTeamResults?.[index];
    const yourError = yourErrors?.[index];
    const otherTeamError = otherTeamErrors?.[index];

    const hasYourResult = yourResult !== undefined;
    const hasOtherTeamResult = otherTeamResult !== undefined;
    const hasYourError = yourError && yourError.length > 0;
    const hasOtherTeamError = otherTeamError && otherTeamError.length > 0;

    const yourResultPassed = hasYourResult && extractAndCompare(yourResult, element.expected);
    const otherTeamPassed = hasOtherTeamResult && extractAndCompare(otherTeamResult, element.expected);

    return (
      <Table.Tr key={element.id} className={styles.tableRow}>
        <Table.Td>
          <Text size="sm" fw={500} ff="monospace" className={styles.cellInput} style={{ maxWidth: '200px', overflow: 'auto', wordBreak: 'break-word' }}>
            {formatValue(element.input)}
          </Text>
        </Table.Td>
        <Table.Td>
          <Box className={styles.cellResult}>
            <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {hasYourResult && !hasYourError && (
                <span className={`${styles.statusIndicator} ${yourResultPassed ? styles.statusPass : styles.statusFail}`}>
                  {yourResultPassed ? <IconCheck size={12} className={styles.passIcon} /> : <IconX size={12} className={styles.failIcon} />}
                </span>
              )}
              {!hasYourResult && !hasYourError && (
                <span className={styles.statusPlaceholder} aria-hidden="true" />
              )}
              {!hasYourError && (
                <Text
                  size="sm"
                  fw={500}
                  ff="monospace"
                  className={`${styles.cellInput} ${hasYourResult ? (yourResultPassed ? styles.passText : styles.failText) : ""}`}
                >
                  {hasYourResult ? formatValue(yourResult) : '-'}
                </Text>
              )}
              {hasYourError && (
                <Tooltip label={formatStderr(yourError)} multiline maw={500} withArrow withinPortal>
                  <Badge color="red" variant="filled" size="lg">
                    Error
                  </Badge>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Table.Td>
        {showOtherTeamColumn && (
          <Table.Td>
            <Box className={styles.cellResult}>
              <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {hasOtherTeamResult && !hasOtherTeamError && (
                  <span className={`${styles.statusIndicator} ${otherTeamPassed ? styles.statusPass : styles.statusFail}`}>
                    {otherTeamPassed ? <IconCheck size={12} className={styles.passIcon} /> : <IconX size={12} className={styles.failIcon} />}
                  </span>
                )}
                {!hasOtherTeamResult && !hasOtherTeamError && (
                  <span className={styles.statusPlaceholder} aria-hidden="true" />
                )}
                {!hasOtherTeamError && (
                  <Text
                    size="sm"
                    fw={500}
                    ff="monospace"
                    className={`${styles.cellInput} ${hasOtherTeamResult ? (otherTeamPassed ? styles.passText : styles.failText) : ""}`}
                  >
                    {hasOtherTeamResult ? formatValue(otherTeamResult) : '-'}
                  </Text>
                )}
                {hasOtherTeamError && (
                  <Tooltip label={formatStderr(otherTeamError)} multiline maw={500} withArrow withinPortal>
                    <Badge color="red" variant="filled" size="lg">
                      Error
                    </Badge>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Table.Td>
        )}
        <Table.Td>
          <Text size="sm" fw={500} ff="monospace" className={styles.cellInput} style={{ maxWidth: '200px', overflow: 'auto', wordBreak: 'break-word' }}>
            {formatValue(element.expected)}
          </Text>
        </Table.Td>
      </Table.Tr>
    );
  }) ?? [];

  const colSpan = showOtherTeamColumn ? 4 : 3;

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder className={styles.container}>
      <Title order={4} mb="md" ta="center" className={styles.title}>
        Test Cases
      </Title>

      <Box className={styles.scrollRegion}>
        <Table highlightOnHover verticalSpacing="sm" striped className={styles.table}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className={styles.tableHeader}>Input</Table.Th>
              <Table.Th className={styles.tableHeader}>{gameType === "TWOPLAYER" ? "Your Code" : "Your Result"}</Table.Th>
              {showOtherTeamColumn && <Table.Th className={styles.tableHeader}>Other Team</Table.Th>}
              <Table.Th className={styles.tableHeader}>Expected Result</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {!convertedTests || convertedTests.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={colSpan}>
                  <Text size="sm" ta="center" c="dimmed" className={styles.stateText}>
                    No test cases available for this game.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}

            {convertedTests && convertedTests.length > 0 && rows}
          </Table.Tbody>
        </Table>
      </Box>
    </Paper>
  );
}