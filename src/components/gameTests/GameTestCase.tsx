import { ActionIcon, Button, Group, Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconPlayerPlay, IconTrash } from "@tabler/icons-react";

import { ParameterType } from "@/lib/ProblemInputOutput";
import { TestableCase, useTestCases } from "../contexts/GameTestCasesContext";
import ParameterInput from "./ParameterInput";
import { useGameState } from "../contexts/GameStateContext";
import { useEffect, useState } from "react";

export interface GameTestCaseProps {
  testableCase: TestableCase,
  onTestCaseChange: (test: TestableCase) => void;
  onTestCaseDelete: (testId: TestableCase["id"]) => void;

  onNewParameter: (parameter: ParameterType) => void;
  onParameterDelete: (parameter: ParameterType) => void;

  showDelete: boolean

  // because we might want to show these test cases
  // on the results screen
  disabled?: boolean,
}

export default function GameTestCase(props: GameTestCaseProps) {
  const gameStateCtx = useGameState();
  const testCaseCtx = useTestCases();
  const { testableCase } = props;

  const [running, setRunning] = useState<boolean>(false);

  const runTest = () => {
    if (!gameStateCtx.socket) throw new Error("Missing socket!");
    setRunning(true);

    gameStateCtx.socket.emit("submitTestCases", {
      code: gameStateCtx.code,
      testCases: testCaseCtx.cases ?? [],
      runIDs: [testableCase.id]
    });
  };

  useEffect(() => {
    if(!running) return;

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
                      onClick={() => props.onParameterDelete(param)}
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
          color="red"
          rightSection={<IconTrash />}
          onClick={() => props.onTestCaseDelete(testableCase.id)}
          disabled={running || props.disabled}
        >
          Delete
        </Button>}
        <Button
          color="green"
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
