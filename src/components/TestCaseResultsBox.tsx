import { Paper, Title, Table, Text, Box, Badge, Tooltip, Tabs, ScrollArea } from "@mantine/core";
import { useEffect, useState, useMemo } from "react";
import { ParameterType, ParameterPrimitiveType } from "@/lib/ProblemInputOutput";
import { IconCheck, IconX } from "@tabler/icons-react";
import deepEqual from "@/util/deepEqual";
import { groupScoredCases } from "@/util/groupScoredCases";
import styles from '@/styles/comps/TestCaseResultsBox.module.css';
import { type TeamGameMadeTestCase } from "@/pages/api/results/[gameId]";

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
  team1GameMadeTests?: TeamGameMadeTestCase[];
  team2GameMadeTests?: TeamGameMadeTestCase[];
  showOtherTeamColumn?: boolean;
  gameType?: "TWOPLAYER" | "FOURPLAYER" | "COOP";
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
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value === "true") return true;
      if (value === "false") return false;
    }
    return value;
  } else if (type === "number") {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
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

export default function TestCaseResultsBox({ tests, team1Results, team2Results, team1Errors, team2Errors, team1GameMadeTests, team2GameMadeTests, showOtherTeamColumn = true, gameType = "FOURPLAYER", userTeamNumber = 1, onSummaryChange }: TestCaseResultsBoxProps) {
  // Convert and validate test cases from API
  const convertedTests = useMemo(() => convertTestCases(tests), [tests]);
  const [activeTab, setActiveTab] = useState<string | null>("scored");
  const isCoOp = gameType === "TWOPLAYER" || gameType === "COOP";

  const team1GameTests = useMemo(() => team1GameMadeTests ?? [], [team1GameMadeTests]);
  const team2GameTests = useMemo(() => team2GameMadeTests ?? [], [team2GameMadeTests]);
  const yourGameTests = userTeamNumber === 2 ? team2GameTests : team1GameTests;
  const otherTeamGameTests = userTeamNumber === 2 ? team1GameTests : team2GameTests;

  const scoredCases = useMemo(
    () =>
      groupScoredCases(
        convertedTests,
        userTeamNumber,
        team1Results ?? [],
        team2Results ?? [],
        team1Errors ?? [],
        team2Errors ?? []
      ),
    [
      convertedTests,
      team1Errors,
      team1Results,
      team2Errors,
      team2Results,
      userTeamNumber,
    ]
  );

  // Notify parent of summary when tests are available
  useEffect(() => {
  if (!onSummaryChange || scoredCases.length === 0) return;

  const yourPassedCount = scoredCases.filter((testCase) =>
    testCase.yourResult !== undefined &&
    extractAndCompare(testCase.yourResult, testCase.expected)
  ).length;

  const otherTeamPassedCount = scoredCases.filter((testCase) =>
    testCase.otherTeamResult !== undefined &&
    extractAndCompare(testCase.otherTeamResult, testCase.expected)
  ).length;

  const yourGamePassedCount = yourGameTests.filter((test) => test.passed).length;
  const yourGameTotal = yourGameTests.length;

  onSummaryChange({
    yourPassedCount: yourPassedCount + (isCoOp ? yourGamePassedCount : 0),
    otherTeamPassedCount: otherTeamPassedCount,
    totalTests: scoredCases.length + (isCoOp ? yourGameTotal : 0),
  });
}, [isCoOp, onSummaryChange, scoredCases, yourGameTests]);


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

  const rows = useMemo(() => {
    return scoredCases.map((row) => {
      const hasYourResult = row.yourResult !== undefined;
      const hasOtherTeamResult = row.otherTeamResult !== undefined;
      const hasYourError = Boolean(row.yourError && row.yourError.length > 0);
      const hasOtherTeamError = Boolean(row.otherTeamError && row.otherTeamError.length > 0);

      const yourResultPassed = hasYourResult && extractAndCompare(row.yourResult, row.expected);
      const otherTeamPassed = hasOtherTeamResult && extractAndCompare(row.otherTeamResult, row.expected);

      return (
        <Table.Tr key={row.id} className={styles.tableRow}>
          <Table.Td>
            <Text size="sm" fw={500} ff="monospace" className={styles.cellInput} style={{ maxWidth: '200px', overflow: 'auto', wordBreak: 'break-word' }}>
              {formatValue(row.input)}
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
                    {hasYourResult ? formatValue(row.yourResult) : '-'}
                  </Text>
                )}
                {hasYourError && (
                  <Tooltip label={formatStderr(row.yourError ?? "")} multiline maw={500} withArrow withinPortal>
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
                      {hasOtherTeamResult ? formatValue(row.otherTeamResult) : '-'}
                    </Text>
                  )}
                  {hasOtherTeamError && (
                    <Tooltip label={formatStderr(row.otherTeamError ?? "")} multiline maw={500} withArrow withinPortal>
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
              {formatValue(row.expected)}
            </Text>
          </Table.Td>
        </Table.Tr>
      );
    });
  }, [scoredCases, showOtherTeamColumn]);

  const renderStatusCell = (passed: boolean, hasError: boolean, value: unknown, error: string | null) => {
    return (
      <Box className={styles.cellResult}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!hasError && (
            <span className={`${styles.statusIndicator} ${passed ? styles.statusPass : styles.statusFail}`}>
              {passed ? <IconCheck size={12} className={styles.passIcon} /> : <IconX size={12} className={styles.failIcon} />}
            </span>
          )}
          {!hasError && (
            <Text
              size="sm"
              fw={500}
              ff="monospace"
              className={`${styles.cellInput} ${passed ? styles.passText : styles.failText}`}
            >
              {formatValue(value)}
            </Text>
          )}
          {hasError && (
            <Tooltip label={formatStderr(error ?? "Execution error")} multiline maw={500} withArrow withinPortal>
              <Badge color="red" variant="filled" size="lg">
                Error
              </Badge>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  };

  const renderTeamGameRows = (teamTests: TeamGameMadeTestCase[]) => {
    return teamTests.map((testCase) => (
      <Table.Tr key={testCase.id} className={styles.tableRow}>
        <Table.Td>
          <Text size="sm" fw={500} ff="monospace" className={styles.cellInput} style={{ maxWidth: '200px', overflow: 'auto', wordBreak: 'break-word' }}>
            {formatValue(testCase.input)}
          </Text>
        </Table.Td>
        <Table.Td>
          {renderStatusCell(testCase.passed, Boolean(testCase.error), testCase.actual, testCase.error)}
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={500} ff="monospace" className={styles.cellInput} style={{ maxWidth: '200px', overflow: 'auto', wordBreak: 'break-word' }}>
            {formatValue(testCase.expected)}
          </Text>
        </Table.Td>
      </Table.Tr>
    ));
  };

  const colSpan = showOtherTeamColumn ? 4 : 3;

  return (
    <Paper shadow="sm" radius="md" p="lg" withBorder className={styles.container}>
      <Title order={4} mb="md" ta="center" className={styles.title}>
        Test Cases
      </Title>

      <Tabs value={activeTab} onChange={setActiveTab} className={styles.tabsRoot}>
        <Tabs.List>
          <Tabs.Tab value="scored">Scoring Tests</Tabs.Tab>
          <Tabs.Tab value="your-tests">
            Your Tests {!isCoOp ? "(Not Scored)" : ""}
          </Tabs.Tab>
          {!isCoOp && (
            <Tabs.Tab value="other-team-tests">
              Other Team Tests (Not Scored)
            </Tabs.Tab>
          )}
        </Tabs.List>
        
        <Tabs.Panel value="scored" pt="md">
          <ScrollArea h={550} className={styles.scrollRegion} type="auto" offsetScrollbars>
            <Table highlightOnHover verticalSpacing="sm" striped className={styles.table}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th className={styles.tableHeader}>Input</Table.Th>
                  <Table.Th className={styles.tableHeader}>{isCoOp ? "Your Code" : "Your Result"}</Table.Th>
                  {showOtherTeamColumn && <Table.Th className={styles.tableHeader}>Other Team</Table.Th>}
                  <Table.Th className={styles.tableHeader}>Expected Result</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {convertedTests.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={colSpan}>
                      <Text size="sm" ta="center" c="dimmed" className={styles.stateText}>
                        No scoring test cases available for this game.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  rows
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="your-tests" pt="md">
          <ScrollArea h={550} className={styles.scrollRegion} type="auto" offsetScrollbars>
            <Table highlightOnHover verticalSpacing="sm" striped className={styles.table}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th className={styles.tableHeader}>Input</Table.Th>
                  <Table.Th className={styles.tableHeader}>Your Result</Table.Th>
                  <Table.Th className={styles.tableHeader}>Expected Result</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {yourGameTests.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text size="sm" ta="center" c="dimmed" className={styles.stateText}>
                        No game-made tests found for your team.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  renderTeamGameRows(yourGameTests)
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>

        {!isCoOp && (
          <Tabs.Panel value="other-team-tests" pt="md">
            <ScrollArea h={550} className={styles.scrollRegion} type="auto" offsetScrollbars>
              <Table highlightOnHover verticalSpacing="sm" striped className={styles.table}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th className={styles.tableHeader}>Input</Table.Th>
                    <Table.Th className={styles.tableHeader}>Other Team Result</Table.Th>
                    <Table.Th className={styles.tableHeader}>Expected Result</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {otherTeamGameTests.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={3}>
                        <Text size="sm" ta="center" c="dimmed" className={styles.stateText}>
                          No game-made tests found for the other team.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    renderTeamGameRows(otherTeamGameTests)
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Tabs.Panel>
        )}
      </Tabs>
    </Paper>
  );
}