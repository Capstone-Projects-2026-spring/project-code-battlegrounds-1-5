import { Button, ComboboxData, Flex, Group, Popover, Select, SelectProps, Stack, Table, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconCode, IconHash, IconList, IconListNumbers, IconMatrix, IconPlayerPlay, IconTable, IconTextSize, IconToggleRight } from "@tabler/icons-react";
import React from "react";
import { type Socket } from "socket.io-client";

import { ParameterPrimitiveType, ParameterType } from "@/lib/ProblemInputOutput";
import { TestableCase } from "./GameTestCasesContext";
import ParameterInput from "./ParameterInput";

export interface GameTestCaseProps {
  testableCase: TestableCase,
  onTestCaseChange: (test: TestableCase) => void;

  onNewParameter: (parameter: ParameterType) => void;

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
      <Table>
        <Table.Tbody>
          {testableCase.functionInput?.map((input, idx) => (
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

          <Table.Tr>
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
        <NewParameterButton onNewParameter={props.onNewParameter} />
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


// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface NewParameterButtonProps extends Pick<GameTestCaseProps, "onNewParameter"> { }

function NewParameterButton(props: NewParameterButtonProps) {
  interface FormValues {
    name: string;
    type: ParameterPrimitiveType | null
  }
  const form = useForm<FormValues>({
    mode: "uncontrolled",
    initialValues: {
      name: '',
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
    console.log(values);
    form.reset();
    close();

    const parameter: ParameterType = {
      name: values.name,
      type: values.type!,
      value: "",
      isOutputParameter: false
    };
    props.onNewParameter(parameter);
  };

  return (
    <Popover opened={opened} onClose={close}>
      <Popover.Target>
        <Button
          rightSection={<IconCode />}
          onClick={toggle}
        >
          New Parameter
        </Button>
      </Popover.Target>

      <Popover.Dropdown>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Flex direction={"column"} gap="xs">
            <TextInput
              required
              label="Parameter Name"
              {...form.getInputProps("name")}
            />
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