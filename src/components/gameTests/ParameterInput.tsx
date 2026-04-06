import { ActionIcon, Alert, Box, Button, Group, MantineStyleProps, NumberInput, Stack, Switch, Text, TextInput } from "@mantine/core";
import { IconAlertTriangle, IconPlus, IconTrash } from "@tabler/icons-react";
import { ParameterType } from "@/lib/ProblemInputOutput";
import deepEqual from "@/util/deepEqual";
import { useMemo } from "react";

interface ParameterInputProps extends MantineStyleProps {
  parameter: ParameterType;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;

  /**
   * The actual value of the test once it gets run.
   * This should only be set for output parameters.
   */
  computedValue?: string | null
}

export default function ParameterInput(props: ParameterInputProps) {
  const {
    parameter,
    value,
    onChange,
    disabled,
    computedValue
  } = props;

  const isEqual = useMemo(() => {
    if (!value || !computedValue) return null;

    // dangerous 👀
    const val1 = JSON.parse(value);
    const val2 = JSON.parse(computedValue);
    return deepEqual(val1, val2);
  }, [value, computedValue]);

  const handleNumberChange = (val: string | number) => {
    onChange(val.toString());
  };

  const handleBooleanChange = (checked: boolean) => {
    onChange(checked.toString());
  };

  // Parse array value safely with optional type parameter
  function parseArrayValue<T = unknown>(val: string | null): T[] {
    if (!val) return [];
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Generic 1D array handlers
  function createArrayHandlers<T>() {
    return {
      handleElementChange: (index: number, newValue: T) => {
        const arr = parseArrayValue<T>(value);
        arr[index] = newValue;
        onChange(JSON.stringify(arr));
      },
      handleAdd: (defaultValue: T) => {
        const arr = parseArrayValue<T>(value);
        arr.push(defaultValue);
        onChange(JSON.stringify(arr));
      },
      handleRemove: (index: number) => {
        const arr = parseArrayValue<T>(value);
        arr.splice(index, 1);
        onChange(JSON.stringify(arr));
      }
    };
  }

  // Generic 2D array handlers
  function create2DArrayHandlers<T>() {
    return {
      handleElementChange: (rowIndex: number, colIndex: number, newValue: T) => {
        const arr = parseArrayValue<T[]>(value);
        if (!arr[rowIndex]) arr[rowIndex] = [];
        arr[rowIndex][colIndex] = newValue;
        onChange(JSON.stringify(arr));
      },
      handleAddRow: () => {
        const arr = parseArrayValue<T[]>(value);
        arr.push([]);
        onChange(JSON.stringify(arr));
      },
      handleRemoveRow: (rowIndex: number) => {
        const arr = parseArrayValue<T[]>(value);
        arr.splice(rowIndex, 1);
        onChange(JSON.stringify(arr));
      },
      handleAddColumn: (rowIndex: number, defaultValue: T) => {
        const arr = parseArrayValue<T[]>(value);
        if (!arr[rowIndex]) arr[rowIndex] = [];
        arr[rowIndex].push(defaultValue);
        onChange(JSON.stringify(arr));
      },
      handleRemoveColumn: (rowIndex: number, colIndex: number) => {
        const arr = parseArrayValue<T[]>(value);
        if (arr[rowIndex]) {
          arr[rowIndex].splice(colIndex, 1);
        }
        onChange(JSON.stringify(arr));
      }
    };
  }

  switch (parameter.type) {
    case "number":
      return (
        <NumberInput
          {...props}
          value={value ? parseFloat(value) : undefined}
          onChange={handleNumberChange}
          disabled={disabled}
          error={isEqual !== null ? `Computed: ${JSON.stringify(computedValue)}` : undefined}
          {...isEqual === true ? {
            styles: {
              input: {
                border: "2px solid var(--mantine-color-green-filled)",
                color: "var(--mantine-color-green-filled)"
              },
              error: {
                color: "var(--mantine-color-green-filled)"
              },
              control: {
                color: "var(--mantine-color-green-filled)",
                ["--input-bd"]: "var(--mantine-color-green-filled)"
              },
              section: {
                borderColor: "var(--mantine-color-green-filled)",
              }
            }
          } : {}}
        />
      );

    case "boolean":
      return (
        <Switch
          checked={value === "true"}
          onChange={(event) => handleBooleanChange(event.currentTarget.checked)}
          disabled={disabled}
          error={isEqual === false ? `Computed: ${JSON.stringify(computedValue)}` : undefined}
        />
      );

    case "array_string": {
      const stringHandlers = createArrayHandlers<string>();
      const arr = parseArrayValue<string>(value);

      return (
        <Stack gap="xs">
          {arr.map((element, idx) => (
            <Group key={idx} gap="xs" wrap="nowrap">
              {idx === 0 && <Text c="dimmed" fw={500}>&#91;</Text>}
              {idx > 0 && <Box w={20} />}

              <TextInput
                {...props}
                value={element?.toString() || ""}
                onChange={(e) => stringHandlers.handleElementChange(idx, e.currentTarget.value)}
                disabled={disabled}
                // style={{ flex: 1 }}
                error={isEqual === false}
              />

              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => stringHandlers.handleRemove(idx)}
                disabled={disabled}
              >
                <IconTrash size={16} />
              </ActionIcon>

              {idx === arr.length - 1 && <Text c="dimmed" fw={500}>&#93;</Text>}
            </Group>
          ))}

          {arr.length === 0 && (
            <Group gap="xs">
              <Text c="dimmed" fw={500}>[ ]</Text>
            </Group>
          )}

          <Group>
            <ActionIcon
              color="blue"
              variant="light"
              onClick={() => stringHandlers.handleAdd("")}
              disabled={disabled}
            >
              <IconPlus size={16} />
            </ActionIcon>
            <Text size="sm" c="dimmed">Add element</Text>
          </Group>

          {isEqual === false && (
            <Text c="red" size="sm">
              Computed: {JSON.stringify(computedValue)}
            </Text>
          )}
        </Stack>
      );
    }

    case "array_number": {
      const numberHandlers = createArrayHandlers<number>();
      const arr = parseArrayValue<number>(value);

      return (
        <Stack gap="xs">
          {arr.map((element, idx) => (
            <Group key={idx} gap="xs" wrap="nowrap">
              {idx === 0 && <Text c="dimmed" fw={500} size="xl">&#91;</Text>}
              {idx > 0 && <Box w={20} />}

              <NumberInput
                {...props}
                value={typeof element === 'number' ? element : parseFloat(element) || 0}
                onChange={(val) => numberHandlers.handleElementChange(idx, typeof val === 'number' ? val : parseFloat(val))}
                disabled={disabled}
                error={isEqual === false}
              />

              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => numberHandlers.handleRemove(idx)}
                disabled={disabled}
              >
                <IconTrash size={16} />
              </ActionIcon>

              {idx === arr.length - 1 && <Text c="dimmed" fw={500} size="xl">&#93;</Text>}
            </Group>
          ))}

          {arr.length === 0 && (
            <Group gap="xs">
              <Text c="dimmed" fw={500}>[ ]</Text>
            </Group>
          )}

          <Button
            variant="light"
            size="compact-sm"
            onClick={() => numberHandlers.handleAdd(0)}
            disabled={disabled}
            leftSection={<IconPlus size="var(--mantine-font-size-md)" />}
          >
            Add element
          </Button>

          {isEqual === false && (
            <Text c="red" size="sm">
              Computed: {JSON.stringify(computedValue)}
            </Text>
          )}
        </Stack>
      );
    }

    case "array_array_string": {
      const stringHandlers = create2DArrayHandlers<string>();
      const arr = parseArrayValue<string[]>(value);

      return (
        <Stack gap="sm">
          <Text c="dimmed" fw={500}>&#91;</Text>

          {arr.map((row, rowIdx) => {
            const rowArray = Array.isArray(row) ? row : [];
            return (
              <Stack key={rowIdx} gap="xs" pl="md">
                {rowArray.map((element, colIdx) => (
                  <Group key={colIdx} gap="xs" wrap="nowrap">
                    {colIdx === 0 && <Text c="dimmed" fw={500}>&#91;</Text>}
                    {colIdx > 0 && <Box w={20} />}

                    <TextInput
                      {...props}
                      value={element?.toString() || ""}
                      onChange={(e) => stringHandlers.handleElementChange(rowIdx, colIdx, e.currentTarget.value)}
                      disabled={disabled}
                    // style={{ flex: 1 }}
                    />

                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => stringHandlers.handleRemoveColumn(rowIdx, colIdx)}
                      disabled={disabled}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>

                    {colIdx === rowArray.length - 1 && <Text c="dimmed" fw={500}>]{rowIdx < arr.length - 1 ? ',' : ''}</Text>}
                  </Group>
                ))}

                {rowArray.length === 0 && (
                  <Group gap="xs">
                    <Text c="dimmed" fw={500}>[ ]{rowIdx < arr.length - 1 ? ',' : ''}</Text>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => stringHandlers.handleRemoveRow(rowIdx)}
                      disabled={disabled}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                )}

                <Button
                  variant="light"
                  size="compact-sm"
                  onClick={() => stringHandlers.handleAddColumn(rowIdx, "")}
                  disabled={disabled}
                  leftSection={<IconPlus size="var(--mantine-font-size-md)" />}
                >
                  Add element to row {rowIdx + 1}
                </Button>
              </Stack>
            );
          })}

          <Text c="dimmed" fw={500}>&#93;</Text>

          <Button
            variant="light"
            size="compact-sm"
            onClick={stringHandlers.handleAddRow}
            disabled={disabled}
            leftSection={<IconPlus size="var(--mantine-font-size-md)" />}
          >
            Add row
          </Button>

          {isEqual === false && (
            <Text c="red" size="sm">
              Computed: {JSON.stringify(computedValue)}
            </Text>
          )}
        </Stack>
      );
    }

    case "array_array_number": {
      const numberHandlers = create2DArrayHandlers<number>();
      const arr = parseArrayValue<number[]>(value);

      return (
        <Stack gap="sm">
          <Text c="dimmed" fw={500}>&#91;</Text>

          {arr.map((row, rowIdx) => {
            const rowArray = Array.isArray(row) ? row : [];
            return (
              <Stack key={rowIdx} gap="xs" pl="md">
                {rowArray.map((element, colIdx) => (
                  <Group key={colIdx} gap="xs" wrap="nowrap">
                    {colIdx === 0 && <Text c="dimmed" fw={500}>&#91;</Text>}
                    {colIdx > 0 && <Box w={20} />}

                    <NumberInput
                      {...props}
                      value={typeof element === 'number' ? element : parseFloat(element) || 0}
                      onChange={(val) => numberHandlers.handleElementChange(rowIdx, colIdx, typeof val === 'number' ? val : parseFloat(val))}
                      disabled={disabled}
                    />

                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => numberHandlers.handleRemoveColumn(rowIdx, colIdx)}
                      disabled={disabled}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>

                    {colIdx === rowArray.length - 1 && <Text c="dimmed" fw={500}>]{rowIdx < arr.length - 1 ? ',' : ''}</Text>}
                  </Group>
                ))}

                {rowArray.length === 0 && (
                  <Group gap="xs">
                    <Text c="dimmed" fw={500}>[ ]{rowIdx < arr.length - 1 ? ',' : ''}</Text>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => numberHandlers.handleRemoveRow(rowIdx)}
                      disabled={disabled}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                )}

                <Button
                  variant="light"
                  size="compact-sm"
                  onClick={() => numberHandlers.handleAddColumn(rowIdx, 0)}
                  disabled={disabled}
                  leftSection={<IconPlus size="var(--mantine-font-size-md)" />}
                >
                  Add element to row {rowIdx + 1}
                </Button>
              </Stack>
            );
          })}

          <Text c="dimmed" fw={500}>&#93;</Text>

          <Button
            size="compact-sm"
            variant="light"
            onClick={numberHandlers.handleAddRow}
            disabled={disabled}
            leftSection={<IconPlus size="var(--mantine-font-size-md)" />}
          >
            Add row
          </Button>

          {isEqual === false && (
            <Text c="red" size="sm">
              Computed: {JSON.stringify(computedValue)}
            </Text>
          )}
        </Stack>
      );
    }

    case "string": {
      return (
        <TextInput
          {...props}
          value={value || ""}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
          error={isEqual === false ? `Computed: ${JSON.stringify(computedValue)}` : undefined}
        />
      );
    }

    default: {
      console.error("Unknown parameter:", props);
      return (
        <Alert variant="light" color="red" icon={<IconAlertTriangle />}>
          Unknown parameter type: &quot;{parameter.type}&quot;. Please report this question.
        </Alert>
      );
    }
  }
}
