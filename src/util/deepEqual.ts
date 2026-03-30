import { ParameterPrimitiveType } from "@/lib/ProblemInputOutput";

type EvaluatedParameter<T extends ParameterPrimitiveType> =
  T extends "string"
  ? string
  : T extends "number"
  ? number
  : T extends "boolean"
  ? boolean
  : T extends "array_string"
  ? string[]
  : T extends "array_number"
  ? number[]
  : T extends "array_array_string"
  ? string[][]
  : T extends "array_array_number"
  ? number[][]
  : never

export default function deepEqual<T extends ParameterPrimitiveType>(val1: EvaluatedParameter<T>, val2: EvaluatedParameter<T>): boolean {

  // At least 1d array
  if (Array.isArray(val1)) {
    if (!Array.isArray(val2)) return false;

    // 2d array
    if (val1[0] && Array.isArray(val1[0])) {
      if (val1.length !== val2.length) return false;

      // Compare each row positionally, but order within rows doesn't matter
      return (val1 as Primitive[][]).every((row, i) => {
        const otherRow = (val2 as Primitive[][])[i];
        if (!Array.isArray(otherRow)) return false;
        return arrayEqual(row, otherRow);
      });
    }

    // 1d array - order doesn't matter
    return arrayEqual(val1 as Primitive[], val2 as Primitive[]);

  } else if (
    typeof val1 === 'number' ||
    typeof val1 === 'string' ||
    typeof val1 === 'boolean'
  ) {
    return primitiveEqual(val1, val2 as typeof val1);
  } else {
    throw new TypeError(`Cannot deepEqual unknown value: ${val1}`);
  }
}

type Primitive = number | string | boolean
function primitiveEqual<T extends Primitive>(val1: T, val2: T): boolean {
  return val1 === val2;
}

// Compare 1D arrays where order doesn't matter
export function arrayEqual<T extends Primitive>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false;

  // Sort both arrays and compare element by element
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();

  return sorted1.every((val, i) => val === sorted2[i]);
}