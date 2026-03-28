import { type ParameterType } from "@/lib/ProblemInputOutput";
import { Button, Stack, Table, Text, TextInput } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";

export interface TestableCase {
  id: number,
  functionInput: ParameterType[],
  expectedOutput: ParameterType
}

export interface GameTestCaseProps {
  testableCase: TestableCase,
  onTestCaseChange: (test: TestableCase) => void;
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
                <TextInput />
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
              <TextInput />
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>

      <Button
        color="green"
        rightSection={<IconPlayerPlay />}
        style={{ alignSelf: "flex-start" }}
      >
        RUN
      </Button>
    </Stack>
  )
}