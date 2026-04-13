import { ActionIcon, Button, Group, Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconPlayerPlay, IconTrash } from "@tabler/icons-react";

import { ParameterType } from "@/lib/ProblemInputOutput";
import { TestableCase } from "@/contexts/GameTestCasesContext";
import ParameterInput from "./ParameterInput";
import { useSocket } from "@/contexts/SocketContext";
import { useGameState } from "@/contexts/GameStateContext";
import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";

export interface GameTestCaseProps {
  testableCase: TestableCase,
  onTestCaseChange: (test: TestableCase) => void;
  onTestCaseDelete: (testId: TestableCase["id"]) => void;

  onParameterDelete: (parameter: ParameterType) => void;

  showDelete: boolean

  // because we might want to show these test cases
  // on the results screen
  disabled?: boolean,
}

export default function GameTestCase(props: GameTestCaseProps) {
  const gameStateCtx = useGameState();
  const { socket } = useSocket();
  const posthog = usePostHog();
  const { testableCase } = props;

  const [running, setRunning] = useState<boolean>(false);

  const runTest = () => {
    if (!socket) throw new Error("Missing socket!");
    setRunning(true);

    socket.emit("submitTestCases", {
      gameId: gameStateCtx.gameId,
      teamId: gameStateCtx.teamId,
      code: gameStateCtx.code,
      testCases: testableCase,
      runIDs: [testableCase.id]
    });

    posthog.capture("test_case_run", {
      gameId: gameStateCtx.gameId,
      code: gameStateCtx.code,
      testableCase
    });
  };

  useEffect(() => {
    if (!running) return;

    // From here on, this effect will only run when `running` is
    // true, and when testableCase changes. While `running`,
    // the only reason why `testableCase` would change is if we
    // receive an update from the socket, which *should* contain
    // `computedOutput`.

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunning(false);
  }, [running, testableCase]);

  return (
    <Stack gap="md" style={{ overflow: "auto", minHeight: 0, flex: 1 }}>
      <Table withRowBorders={false}>
        <Table.Tbody>
          {testableCase.functionInput?.map((param, idx) => (
            <Table.Tr key={idx}>
              <Table.Td align="right">
                <Text c="dimmed">
                  {param.name} =
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ParameterInput
                    parameter={param}
                    value={param.value}
                    onChange={(value) => {
                      const updatedInputs = [...testableCase.functionInput];
                      updatedInputs[idx] = { ...param, value };
                      props.onTestCaseChange({
                        ...testableCase,
                        functionInput: updatedInputs
                      });
                    }}
                    disabled={props.disabled}
                    flex={1}
                  />

                  {testableCase.functionInput.length !== 1 && <Tooltip label="Remove parameter">
                    <ActionIcon
                      color="red"
                      variant="light"
                      size="sm"
                      onClick={() => {
                        props.onParameterDelete(param);
                        posthog.capture("parameter_deleted", {
                          gameId: gameStateCtx.gameId,
                          parameter: param
                        });
                      }}
                    >
                      <IconTrash />
                    </ActionIcon>
                  </Tooltip>}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}

          <Table.Tr style={{
            borderTop: "calc(.120rem * var(--mantine-scale)) solid var(--table-border-color)",
          }}>
            <Table.Td align="right">
              <Text c="dimmed">
                Output :
              </Text>
            </Table.Td>
            <Table.Td>
              <ParameterInput
                parameter={testableCase.expectedOutput}
                value={testableCase.expectedOutput.value}
                onChange={(value) => {
                  props.onTestCaseChange({
                    ...testableCase,
                    expectedOutput: {
                      ...testableCase.expectedOutput,
                      value
                    }
                  });
                }}
                disabled={props.disabled}
                computedValue={testableCase.computedOutput}
              />
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>

      <Group align="flex-start" gap="sm">
        {props.showDelete && <Button
          color="red.5"
          rightSection={<IconTrash />}
          onClick={() => {
            props.onTestCaseDelete(testableCase.id);
            posthog.capture("test_case_deleted", {
              gameId: gameStateCtx.gameId,
              testableCase
            });
          }}
          disabled={running || props.disabled}
        >
          Delete
        </Button>}
        <Button
          rightSection={<IconPlayerPlay />}
          onClick={runTest}
          disabled={running || props.disabled}
          loading={running}
        >
          Run
        </Button>
      </Group>
    </Stack>
  );
}
