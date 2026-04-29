---
sidebar_position: 2
title: Execution
---
## `registerExecutionHandlers` — `server/socket/handlers/executionHandlers.js`

Socket handler for submitting code to the executor and persisting execution results in the database. It depends on `EXECUTOR_ADDR` for the HTTP call to the execution service and on Prisma for storage.

## Server Events

### `submitCode`

Submits a team solution for execution and persistence.

```typescript
socket.emit("submitCode", {
	roomId: string,
	code: string,
	type: "TWOPLAYER" | "FOURPLAYER",
	team?: "team1" | "team2",
	teamId?: string,
	testCases?: Array<any>,
	runIDs?: Array<any>,
	submitTime?: string | number | Date,
	submitTimer?: string,
});
```

| Field | Type | Required | Description |
|---|---|---|---|
| `roomId` | `string` | Yes | Game room ID. |
| `code` | `string` | Effectively yes | Source code submitted by the team. The validator marks it optional, but execution requires it. |
| `type` | `TWOPLAYER` \| `FOURPLAYER` | Yes | Game mode. |
| `team` | `team1` \| `team2` | Four-player only | Identifies which team submitted. |
| `teamId` | `string` | Optional | Socket room for notifying the submitting team. |
| `testCases` | `Array<any>` | Optional | Fallback game test cases when Redis has none. |
| `runIDs` | `Array<any>` | Optional | Fallback IDs for the test cases. |
| `submitTime` | `string` \| `number` \| `Date` | Optional | Submission timestamp source. |
| `submitTimer` | `string` | Optional | Alternate timestamp string; if blank, the handler falls back to `submitTime`. |

#### Behavior

1. Validates the payload with Zod.
2. Normalizes `submitTime` and `submitTimer` into a persisted timestamp.
3. For `TWOPLAYER` games:
	 1. Loads the current `gameResult` and `gameRoom`.
	 2. Stores the submitted code in `gameResult.team1Code` and `team1SubmittedAt`.
	 3. Fetches team-generated test cases from Redis via `gameService.getTestCases(team1Id)`.
	 4. Falls back to the event payload if Redis has no test cases.
	 5. Loads hidden tests from `problemTest` and normalizes them.
	 6. Calls `executeAndPersist(...)` once for team 1.
	 7. Marks the game finished, emits `gameEnded`, cleans up timers, removes players from sockets, and deletes the VM.
4. For `FOURPLAYER` games:
	 1. Requires `team`.
	 2. Deduplicates submissions using Redis key `game:{roomId}:submissions`.
	 3. Stores the submitting team's code and timestamp in `gameResult`.
	 4. Waits until both teams have submitted.
	 5. Loads team-specific test cases from Redis, falling back to the payload when needed.
	 6. Loads hidden tests once and normalizes them.
	 7. Executes both teams in parallel with `executeAndPersist(...)`.
	 8. If either execution fails, the game is not finalized and an error is emitted.
	 9. If both succeed, the game is finished, timers are cleaned up, `gameEnded` is emitted, sockets are removed, and the VM is deleted.

#### Errors

| Scenario | Result |
|---|---|
| Invalid payload | Emits `error` with `Invalid payload for submitCode.` |
| Missing `roomId` | Returns early without emitting a success event. |
| Missing `gameResult` or `gameRoom` | Emits `error` with `Game or result not found`. |
| Missing `team` in four-player mode | Emits `error` with `Missing team for four-player submitCode.` |
| Executor request failure | Logs the error and emits a generic socket error from the caller. |
| Persistence failure | Logs the error and emits a generic socket error from the caller. |

### `submitTestCases`

Executes arbitrary test cases for the caller and sends back computed outputs.

```typescript
socket.emit("submitTestCases", {
	roomId: string,
	code: string,
	testCases: Array<any>,
	runIDs: Array<any>,
});
```

| Field | Type | Required | Description |
|---|---|---|---|
| `roomId` | `string` | Yes | Game room ID. |
| `code` | `string` | Yes | Source code to execute. |
| `testCases` | `Array<any>` | Yes | Test cases to send to the executor. |
| `runIDs` | `Array<any>` | Yes | Test case IDs passed through to the executor. |

#### Behavior

1. Calls the executor at `EXECUTOR_ADDR/execute` with `language: "javascript"`.
2. Base64-encodes `code` before sending it.
3. Returns only the matching results for the provided `testCases`.
4. Emits `receiveTestCaseSync` to `socket.teamId` when available; otherwise emits to the current socket.

#### Errors

| Scenario | Result |
|---|---|
| Executor request or parsing failure | Emits `error` with `Sorry that didn't work try again in a few seconds`. |

## Helper

### `async executeAndPersist(params): Promise<{ teamNumber: number, totalTests: number, passedCount: number, executionTimeMs: number[], success: true }>`

Internal helper used by `submitCode` to run the executor and persist results.

| Parameter | Type | Description |
|---|---|---|
| `roomId` | `string` | Game room ID used in the executor payload. |
| `gameResultId` | `string` | Prisma `gameResult` ID used for persistence. |
| `code` | `string` | Submitted source code. |
| `teamNumber` | `number` | Team being executed, usually `1` or `2`. |
| `testCases` | `Array<any>` | Game test cases to execute. |
| `testCaseIds` | `Array<any>` | IDs for the game test cases. |
| `gameRoomId` | `string` | Direct game room reference stored with each `gameTest` row. |
| `hiddenTestCases` | `Array<any>` | Hidden test cases to append after the game test cases. Defaults to `[]`. |
| `hiddenTestCaseIds` | `Array<any>` | IDs for the hidden test cases. Defaults to `[]`. |

#### Behavior

1. Builds a combined execution list from game and hidden tests.
2. Sends a POST request to `${EXECUTOR_ADDR}/execute`.
3. Base64-encodes the code and JSON-stringifies the test cases and run IDs.
4. Parses `results` from the executor response.
5. Upserts one `gameTest` row per executed test case.
6. Persists team-specific columns such as `team1ActualOutput`, `team1Passed`, `team2ActualOutput`, and `team2Passed` depending on `teamNumber`.
7. Returns aggregate metadata including the number of tests, passed count, and per-test execution times.

#### Errors

| Scenario | Result |
|---|---|
| Executor HTTP failure | Throws an error. |
| Prisma transaction failure | Throws an error. |

## Preconditions

- `EXECUTOR_ADDR` must point to the execution service.
- The executor must be available before the handler is invoked.
- Database access must be available for persistence.
- The executor can only accept json

## Postconditions

- Successful submissions persist `gameTest` rows for both game and hidden tests.
- Completed games emit `gameEnded` and are marked finished.
- `submitTestCases` replies with computed outputs for the requested cases.


