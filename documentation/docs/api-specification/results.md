---
title: Results Page API
description: Api to get game info for results page
sidebar_position: 7
hide_table_of_contents: true
---


# Results API - `src/pages/api/results/[gameId].ts`

`GET /api/results/[gameId]`. Gets all information needed from the game for results

### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

**Method:** `GET` only. Returns `405` for any other method.

**Query** `{ gameId } = req.body;`

**Returns:** 
```
    {
        problem: {
            id: gameRoom.problem.id,
            title: gameRoom.problem.title,
            description: gameRoom.problem.description,
            difficulty: gameRoom.problem.difficulty,
            topics: gameRoom.problem.topics,
        },
        gameType: gameRoom.gameType,
        userTeamNumber,
        team1Code: gameRoom.gameResult?.team1Code ?? null,
        team2Code: gameRoom.gameResult?.team2Code ?? null,

        tests: unifiedTestCases,
        team1Results: team1ActualOutputs,
        team2Results: team2ActualOutputs,
        team1PassedCount,
        team2PassedCount,
        totalTests: unifiedTestCases.length,
        team1TotalTests,
        team2TotalTests,
        team1AverageExecutionTime,
        team2AverageExecutionTime,
        team1Errors: team1ErrorsArray,
        team2Errors: team2ErrorsArray,
        team1GameMadeTests,
        team2GameMadeTests,
        team1TimeLeftSeconds,
        team2TimeLeftSeconds,
    }
``` 

**Preconditions:**
- Must be signed in
- Game must have been created

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `405` | Non-GET or Non-PUT request | `{ error: "Method not allowed" }` |
| `401` | Not authorized | `{ error: "Not authorized" }` |
| `500` | Failed to create/update database | `{ message: 'Failed to create game room' }` |