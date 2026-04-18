import { ActionIcon, Box, Button, Group, Stack, Tabs, Tooltip } from "@mantine/core";
import { IconPlayerTrackNextFilled, IconPlus } from "@tabler/icons-react";
import { Panel } from "react-resizable-panels";

import { useTestCases } from "@/contexts/GameTestCasesContext";
import GameTestCase from "@/components/gameTests/GameTestCase";
import NewParameterButton from "@/components/gameTests/NewParameterButton";
import { useGameRoom } from "@/contexts/GameRoomContext";

export default function TesterPanel() {
  const testCaseCtx = useTestCases();
  const {
    activeTestId,
    setActiveTestId,
    isSpectator,
    isWaitingForOtherTeam,
    runningAllTests,
    addNewTest,
    handleRunAllTests,
    handleNewParameter,
    handleTestBoxChange,
    handleParameterDelete,
    removeTest,
    handleExpectedOutputTypeChange,
  } = useGameRoom();

  const currentTestCase = testCaseCtx.cases.find(
    (testCase) => testCase.id === activeTestId,
  );

  return (
    <Panel defaultSize={25} minSize={20}>
      <Box
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Box
          p="xs"
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            flex: 1,
          }}
        >
          <Stack style={{ minHeight: 0, flex: 1 }}>
            <Group justify="space-between">
              <Tabs
                value={String(activeTestId)}
                onChange={(value) => {
                  setActiveTestId(Number(value ?? 0));
                }}
                variant="outline"
              >
                <Tabs.List>
                  {testCaseCtx.cases.map((test, idx) => (
                    <Tabs.Tab key={test.id} value={String(test.id)}>
                      Test {idx + 1}
                    </Tabs.Tab>
                  ))}

                  {testCaseCtx.cases.length < 5 && !isSpectator && (
                    <Tooltip label="New Test">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={addNewTest}
                        size="sm"
                        style={{ alignSelf: "center" }}
                        ml="xs"
                        disabled={isWaitingForOtherTeam}
                      >
                        <IconPlus />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Tabs.List>
              </Tabs>

              <Group gap="xs">
                <NewParameterButton onNewParameter={handleNewParameter} />
                <Button
                  size="compact-sm"
                  variant="filled"
                  disabled={isSpectator || runningAllTests || isWaitingForOtherTeam}
                  loading={runningAllTests}
                  onClick={handleRunAllTests}
                  rightSection={
                    <IconPlayerTrackNextFilled size="var(--mantine-font-size-lg)" />
                  }
                >
                  Run All
                </Button>
              </Group>
            </Group>

            {currentTestCase ? (
              <GameTestCase
                testableCase={currentTestCase}
                onTestCaseChange={handleTestBoxChange}
                onParameterDelete={handleParameterDelete}
                onTestCaseDelete={removeTest}
                showDelete={testCaseCtx.cases.length !== 1}
                disabled={runningAllTests}
                onExpectedOutputTypeChange={handleExpectedOutputTypeChange}
              />
            ) : null}
          </Stack>
        </Box>
      </Box>
    </Panel>
  );
}
