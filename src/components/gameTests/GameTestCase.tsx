import { ActionIcon, Button, Group, Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { type Socket } from "socket.io-client";

import { ParameterType } from "@/lib/ProblemInputOutput";
import { TestableCase } from "./GameTestCasesContext";
import ParameterInput from "./ParameterInput";

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

  // so we can send test case updates over the wire
  // (optional because of results screen)
  socket?: Socket
}

export default function GameTestCase(props: GameTestCaseProps) {
  const { testableCase } = props;

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
        >
          Delete
        </Button>}
        <Button
          color="green"
          rightSection={<IconPlayerPlay />}
        >
          Run
        </Button>
      </Group>
    </Stack>
  );
}
