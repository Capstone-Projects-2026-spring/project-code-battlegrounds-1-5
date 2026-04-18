import { ActionIcon, Box, Button, Group, Stack, Tabs, Tooltip } from "@mantine/core";
import { Role } from "@prisma/client";
import { IconPlayerTrackNextFilled, IconPlus } from "@tabler/icons-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { Panel } from "react-resizable-panels";

import GameTestCase from "@/components/gameTests/GameTestCase";
import NewParameterButton from "@/components/gameTests/NewParameterButton";
import { useGameRoom } from "@/contexts/GameRoomContext";
import { TestableCase, useTestCases } from "@/contexts/GameTestCasesContext";
import { useSocket } from "@/contexts/SocketContext";
import type { ParameterType } from "@/lib/ProblemInputOutput";

export default function TesterPanel() {
  const { socket } = useSocket();
  const testCaseCtx = useTestCases();
  const posthog = usePostHog();

  const [activeTestId, setActiveTestId] = useState<number>(0);
  const [runningAllTests, setRunningAllTests] = useState<boolean>(false);

  const {
    role,
    isSpectator,
    isWaitingForOtherTeam,
    teamSelected,
    gameId,
    code,
  } = useGameRoom();
  const canMutateTests =
    role === Role.TESTER && !isSpectator && !isWaitingForOtherTeam;

  useEffect(() => {
    if (!socket) return;

    const handleTestCaseSync = () => {
      setRunningAllTests(false);
    };

    socket.on("receiveTestCaseSync", handleTestCaseSync);

    return () => {
      socket.off("receiveTestCaseSync", handleTestCaseSync);
    };
  }, [socket]);

  const selectedTestId = testCaseCtx.cases.some(
    (testCase) => testCase.id === activeTestId,
  )
    ? activeTestId
    : (testCaseCtx.cases[0]?.id ?? 0);

  const addNewTest = () => {
    if (!canMutateTests || !teamSelected) return;
    if (testCaseCtx.cases.length >= 5) return;

    const outputParameter = testCaseCtx.parameters.find(
      (parameter) => parameter.isOutputParameter,
    );
    if (!outputParameter) return;

    const newId = testCaseCtx.cases.reduce(
      (maxId, testCase) => Math.max(maxId, testCase.id),
      -1,
    ) + 1;

    const newCase: TestableCase = {
      id: newId,
      functionInput: testCaseCtx.parameters
        .filter((parameter) => !parameter.isOutputParameter)
        .map((parameter) => ({
          ...parameter,
          value: null,
        })),
      expectedOutput: {
        ...outputParameter,
        value: null,
      },
    };

    const updatedCases = [...testCaseCtx.cases, newCase];
    testCaseCtx.addCase(newCase);
    setActiveTestId(newId);

    socket?.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: updatedCases,
    });
  };

  const removeTest = (testId: TestableCase["id"]) => {
    if (!canMutateTests || !teamSelected || testCaseCtx.cases.length === 1) {
      return;
    }

    const updatedCases = testCaseCtx.cases.filter((testCase) => testCase.id !== testId);
    testCaseCtx.removeCase(testId);
    setActiveTestId(updatedCases[0]?.id ?? 0);

    socket?.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: updatedCases,
    });
  };

  const handleNewParameter = (parameter: ParameterType) => {
    if (!canMutateTests || !teamSelected) return;

    const updatedCases = testCaseCtx.cases.map((testCase) => ({
      ...testCase,
      functionInput: [...testCase.functionInput, parameter],
    }));

    testCaseCtx.setParameters((prevParameters) => [...prevParameters, parameter]);
    testCaseCtx.setCases(updatedCases);

    socket?.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: updatedCases,
    });

    posthog.capture("parameter_created", {
      gameId,
      parameter,
    });
  };

  const handleParameterDelete = (parameter: ParameterType) => {
    if (!canMutateTests || !teamSelected) return;

    const updatedCases = testCaseCtx.cases.map((testCase) => ({
      ...testCase,
      functionInput: testCase.functionInput.filter(
        (inputParameter) => inputParameter.name !== parameter.name,
      ),
    }));

    testCaseCtx.setParameters((prevParameters) =>
      prevParameters.filter((existingParameter) => existingParameter.name !== parameter.name),
    );
    testCaseCtx.setCases(updatedCases);

    socket?.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: updatedCases,
    });
  };

  const handleTestBoxChange = (testCase: TestableCase) => {
    if (!canMutateTests || !socket || !teamSelected) {
      return;
    }

    const updatedCases = testCaseCtx.cases.map((existingCase) =>
      existingCase.id === selectedTestId ? testCase : existingCase,
    );

    testCaseCtx.setCases(updatedCases);
    socket.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: updatedCases,
    });
  };

  const handleExpectedOutputTypeChange = (type: ParameterType["type"]) => {
    if (!canMutateTests || !socket || !teamSelected) {
      return;
    }

    const currentOutputType = testCaseCtx.parameters.find(
      (parameter) => parameter.isOutputParameter,
    )?.type;
    if (currentOutputType === type) return;

    testCaseCtx.setParameters((prevParameters) =>
      prevParameters.map((parameter) =>
        parameter.isOutputParameter
          ? {
              ...parameter,
              type,
              value: null,
            }
          : parameter,
      ),
    );

    const updatedCases = testCaseCtx.cases.map((testCase) => ({
      ...testCase,
      expectedOutput: {
        ...testCase.expectedOutput,
        type,
        value: null,
      },
      computedOutput: null,
    }));

    testCaseCtx.setCases(updatedCases);
    socket.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: updatedCases,
    });
  };

  const handleRunAllTests = () => {
    if (!canMutateTests || !socket) return;

    setRunningAllTests(true);
    socket.emit("submitTestCases", {
      code,
      testCases: testCaseCtx.cases,
      runIDs: testCaseCtx.cases.map((testCase) => testCase.id),
    });
  };

  const currentTestCase = testCaseCtx.cases.find(
    (testCase) => testCase.id === selectedTestId,
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
                value={String(selectedTestId)}
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

                  {testCaseCtx.cases.length < 5 && (
                    <Tooltip label="New Test">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={addNewTest}
                        size="sm"
                        style={{ alignSelf: "center" }}
                        ml="xs"
                        disabled={!canMutateTests}
                      >
                        <IconPlus />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Tabs.List>
              </Tabs>

              <Group gap="xs">
                <NewParameterButton
                  onNewParameter={handleNewParameter}
                  disabled={!canMutateTests}
                />
                <Button
                  size="compact-sm"
                  variant="filled"
                  disabled={!canMutateTests || runningAllTests}
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
                disabled={!canMutateTests || runningAllTests}
                onExpectedOutputTypeChange={handleExpectedOutputTypeChange}
              />
            ) : null}
          </Stack>
        </Box>
      </Box>
    </Panel>
  );
}
