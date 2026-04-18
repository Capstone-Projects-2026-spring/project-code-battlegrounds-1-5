function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error('Validation error for socket event', { errors: result.error });
    return false;
  }
  return result.data;
}

function getDefaultTestCases() {
  return [
    {
      id: 0,
      functionInput: [
        { name: "a", type: "number", value: "2" },
        { name: "b", type: "number", value: "3" },
      ],
      expectedOutput: {
        name: "result",
        type: "number",
        value: "5",
        isOutputParameter: true,
      },
    },
  ];
}

async function getOrCreateTeamTestCases(gameService, teamId) {
  const existing = await gameService.getTestCases(teamId);
  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }

  const defaults = getDefaultTestCases();
  await gameService.saveTestCases(teamId, defaults);
  return defaults;
}

module.exports = { validate, getOrCreateTeamTestCases };