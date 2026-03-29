import { Button, Group, Stack, Table, Text, TextInput } from "@mantine/core";
import { IconCode, IconPlayerPlay } from "@tabler/icons-react";
import { TestableCase } from "./GameTestCasesContext";
import { type Socket } from "socket.io-client";

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
                <TextInput
                  disabled={props.disabled}
                />
              </Table.Td>
            </Table.Tr>
          ))}

          <Table.Tr>
            <Table.Td align="right">
              <Text c="dimmed">
                Output =
              </Text>
            </Table.Td>
            <Table.Td>
              <TextInput
                disabled={props.disabled}
              />
            </Table.Td>
          </Table.Tr>
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