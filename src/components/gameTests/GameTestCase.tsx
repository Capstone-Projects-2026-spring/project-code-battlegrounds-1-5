import { ActionIcon, Button, ComboboxData, Flex, Group, Popover, Select, SelectProps, Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconPlayerPlay, IconTrash, IconCode, IconCheck, IconHash, IconList, IconListNumbers, IconMatrix, IconTable, IconTextSize, IconToggleRight } from "@tabler/icons-react";

import { ParameterPrimitiveType, ParameterType } from "@/lib/ProblemInputOutput";
import { TestableCase, useTestCases } from "@/contexts/GameTestCasesContext";
import ParameterInput from "./ParameterInput";
import { useSocket } from "@/contexts/SocketContext";
import { useGameState } from "@/contexts/GameStateContext";
import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { useDisclosure } from "@mantine/hooks";
import { useForm } from "@mantine/form";

export interface GameTestCaseProps {
  testableCase: TestableCase,
  onTestCaseChange: (test: TestableCase) => void;
  onExpectedOutputTypeChange: (type: ParameterPrimitiveType) => void;
  onTestCaseDelete: (testId: TestableCase["id"]) => void;

  onParameterDelete: (parameter: ParameterType) => void;

  showDelete: boolean

  // because we might want to show these test cases
  // on the results screen
  disabled?: boolean,
}

export default function GameTestCase(props: GameTestCaseProps) {
  const gameStateCtx = useGameState();
  const testCaseCtx = useTestCases();
  const { socket } = useSocket();
  const posthog = usePostHog();
  const { testableCase } = props;

  const [running, setRunning] = useState<boolean>(false);

  const runTest = () => {
    if (!socket) throw new Error("Missing socket!");
    setRunning(true);

    socket.emit("submitTestCases", {
      code: gameStateCtx.code,
      testCases: testCaseCtx.cases,
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
              <Group>
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
                  flex={1}
                />

                <ChangeParameterTypeButton
                  onTypeChanged={(type) => {
                    props.onExpectedOutputTypeChange(type);
                  }}
                />
              </Group>
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

interface ChangeParameterTypeButtonProps {
  onTypeChanged: (type: ParameterPrimitiveType) => void;
}
function ChangeParameterTypeButton(props: ChangeParameterTypeButtonProps) {
  interface FormValues {
    type: ParameterPrimitiveType | null
  }
  const form = useForm<FormValues>({
    mode: "uncontrolled",
    initialValues: {
      type: null
    }
  });

  const data: ComboboxData = [
    { value: "string", label: "String" },
    { value: "number", label: "Number" },
    { value: "boolean", label: "Boolean" },
    { value: "array_string", label: "String Array" },
    { value: "array_number", label: "Number Array" },
    { value: "array_array_string", label: "2D String Array" },
    { value: "array_array_number", label: "2D Number Array" },
  ];

  const iconProps = {
    stroke: 1.5,
    color: "currentColor",
    opacity: 0.8,
    size: 20
  };
  const icons: Record<ParameterPrimitiveType, React.ReactNode> = {
    string: <IconTextSize {...iconProps} />,
    number: <IconHash {...iconProps} />,
    boolean: <IconToggleRight {...iconProps} />,
    array_string: <IconList {...iconProps} />,
    array_number: <IconListNumbers {...iconProps} />,
    array_array_string: <IconTable {...iconProps} />,
    array_array_number: <IconMatrix {...iconProps} />
  };

  const renderSelectOption: SelectProps["renderOption"] = ({ option, checked }) => (
    <Group flex={1} gap="xs">
      {icons[option.value as ParameterPrimitiveType]}
      {option.label}
      {checked && <IconCheck style={{ marginInlineStart: 'auto' }} {...iconProps} />}
    </Group>
  );

  const [opened, { close, toggle }] = useDisclosure();

  const handleSubmit = (values: FormValues) => {
    form.reset();
    if (values.type)
      props.onTypeChanged(values.type);
    close();
  };

  return (
    <Popover opened={opened}>
      <Popover.Target>
        <Tooltip label="Change output type">
          <ActionIcon
            color="blue"
            variant="light"
            size="sm"
            onClick={toggle}
          >
            <IconCode />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Flex direction={"column"} gap="xs">
            <Select
              required
              label="Type"
              data={data}
              renderOption={renderSelectOption}
              comboboxProps={{ withinPortal: false }}
              {...form.getInputProps("type")}
            />

            <Group gap="xs" flex={1} mt="sm">
              <Button
                size="sm"
                onClick={close}
                variant="outline"
                flex={1}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                flex={1}
              >
                Done
              </Button>
            </Group>
          </Flex>
        </form>
      </Popover.Dropdown>
    </Popover>
  );
}