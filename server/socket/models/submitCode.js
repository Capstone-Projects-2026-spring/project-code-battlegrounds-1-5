const { GameType } = require("@prisma/client");
const z = require("zod");

const ParameterPrimitive = z.union([
  z.literal("string"),
  z.literal("number"),
  z.literal("array_string"),
  z.literal("array_number"),
  z.literal("array_array_string"),
  z.literal("array_array_number"),
  z.literal("boolean")
]);
exports.parameterPrimitive = ParameterPrimitive;

const parameter = z.object({
  name: z.string(),
  type: ParameterPrimitive,
  value: z.string().nullable(), // Wz.ill be coerced into the correz.ct primitive based on type.
  isOutputParameter: z.optional(z.boolean().default(false))
});
exports.parameter = parameter;

const testableCase = z.object({
    id: z.number(),
    functionInput: z.array(),
    expectedOutput: parameter,
    computedOutput: z.optional(z.string())
});
exports.testableCase = testableCase;


/* 
socket.emit("submitCode", {
      roomId: gameId,
      code: gameStateCtx.code,
      type: gameType,
      team,
      teamId: teamSelected,
      testCases: testCaseCtx.cases,
      runIDs: indexes,
    });
*/
const submitCodeSchema = z.object({
    roomId: z.string(),
    code: z.string().max(10000).optional(), // Adjust max length as needed
    type: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER]),
    team: z.enum(["team1", "team2"]).nullable().optional(),
    teamId: z.string().optional(),
    testCases: z.array(testableCase),
    runIDs: z.array(z.number())
});
exports.submitCodeSchema = submitCodeSchema;
