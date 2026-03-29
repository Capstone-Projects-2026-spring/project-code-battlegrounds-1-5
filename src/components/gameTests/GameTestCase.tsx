import { Button, Group, Stack, Table, Text } from "@mantine/core";
import { IconCode, IconPlayerPlay } from "@tabler/icons-react";
import { TestableCase } from "./GameTestCasesContext";
import { type Socket } from "socket.io-client";
import ParameterInput from "./ParameterInput";

export interface GameTestCaseProps {
  testableCase: TestableCase,
  onTestCaseChange: (test: TestableCase) => void;

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
    <Stack gap="md">
      <Table>
        <Table.Tbody>
          {testableCase.functionInput.map((input, idx) => (
            <Table.Tr key={idx}>
              <Table.Td align="right">
                <Text c="dimmed">
                  {input.name} =
                </Text>
              </Table.Td>
              <Table.Td>
                <ParameterInput
                  parameter={input}
                  value={input.value}
                  onChange={(value) => {
                    const updatedInputs = [...testableCase.functionInput];
                    updatedInputs[idx] = { ...input, value };
                    props.onTestCaseChange({
                      ...testableCase,
                      functionInput: updatedInputs
                    });
                  }}
                  disabled={props.disabled}
                />
              </Table.Td>
            </Table.Tr>
          ))}

          {testableCase.expectedOutput.map((output, idx) => (
            <Table.Tr key={`output-${idx}`}>
              <Table.Td align="right">
                <Text c="dimmed">
                  {output.name} =
                </Text>
              </Table.Td>
              <Table.Td>
                <ParameterInput
                  parameter={output}
                  value={output.value}
                  onChange={(value) => {
                    const updatedOutputs = [...testableCase.expectedOutput];
                    updatedOutputs[idx] = { ...output, value };
                    props.onTestCaseChange({
                      ...testableCase,
                      expectedOutput: updatedOutputs
                    });
                  }}
                  disabled={props.disabled}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Group align="flex-start" gap="sm">
        <Button
          rightSection={<IconCode />}
        >
          New Parameter
        </Button>
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