import { NumberInput, Switch, Textarea, TextInput } from "@mantine/core";
import { ParameterType } from "@/lib/ProblemInputOutput";

interface ParameterInputProps {
  parameter: ParameterType;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export default function ParameterInput({ parameter, value, onChange, disabled }: ParameterInputProps) {
  const handleNumberChange = (val: string | number) => {
    onChange(val.toString());
  };

  const handleBooleanChange = (checked: boolean) => {
    onChange(checked.toString());
  };

  switch (parameter.type) {
    case "number":
      return (
        <NumberInput
          value={value ? parseFloat(value) : undefined}
          onChange={handleNumberChange}
          disabled={disabled}
          placeholder={`Enter ${parameter.name}`}
        />
      );

    case "boolean":
      return (
        <Switch
          checked={value === "true"}
          onChange={(event) => handleBooleanChange(event.currentTarget.checked)}
          disabled={disabled}
          label={value === "true" ? "true" : "false"}
        />
      );

    case "array_string":
    case "array_number":
      return (
        <Textarea
          value={value || ""}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
          placeholder={`Enter array as JSON, e.g., ${parameter.type === "array_string" ? '["a", "b", "c"]' : "[1, 2, 3]"}`}
          minRows={2}
        />
      );

    case "array_array_string":
    case "array_array_number":
      return (
        <Textarea
          value={value || ""}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
          placeholder={`Enter 2D array as JSON, e.g., ${parameter.type === "array_array_string" ? '[["a", "b"], ["c", "d"]]' : "[[1, 2], [3, 4]]"}`}
          minRows={3}
        />
      );

    case "string":
    default:
      return (
        <TextInput
          value={value || ""}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
        />
      );
  }
}
