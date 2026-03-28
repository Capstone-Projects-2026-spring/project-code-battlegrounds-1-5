import * as z from "zod";

export const ParameterPrimitive = z.union([
  z.literal("string"),
  z.literal("number"),
  z.literal("array_string"),
  z.literal("array_number"),
  z.literal("boolean")
]);
export type ParameterPrimitiveType = z.infer<typeof ParameterPrimitive>

// Covers both input and output parameters
export const Parameter = z.object({
  name: z.string(),
  type: ParameterPrimitive,
  value: z.string() // Will be coerced into the correct primitive based on type.
});
export type ParameterType = z.infer<typeof Parameter>

export const Language = z.union([
  z.literal("javascript")
]);

export const TestCase = z.object({
  id: z.uuid().optional(),
  problemId: z.string(),
  functionInput: z.array(Parameter),
  expectedOutput: z.array(Parameter),
  language: Language,
  optimalTimeMs: z.number(),
  hidden: z.boolean().optional().default(true)
});