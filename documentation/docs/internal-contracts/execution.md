---
sidebar_position: 2
title: Execution
---
## `executionHandler` — `server\socket\handlers\executionHandlers.js`
An indvidual socket connection with the sole purpose posting and fetching to the execution as well as storing the results in a persistant database. Requires `EXECUTION_ADDR` and `EXECUTION_PORT`.

## Methods
`async executeAndPersist(params): Promise<ExecutionResults>`
Sends Parameters to the executor. Returns Socket Error Notification if Execution has failed.

| Parameter | Type | Description |
|---|---|---|
| roomId, | string | the individual room code for each game|
| gameResultId | string | The id of the game result |
| code | string | The code of the submitted team |
| teamNumber | number | The team of which the socket is activated for |
| testCases | Array | Array of testable cases in executor format |
| testCasesIds | Array | Array of each individual testCaseId
| gameRoomId | string | Direct reference for the game room ID |
| hiddenTestCases| Array | Hidden Testable case array |
| hiddenTestCasesIds | Array | Array of hidden testcase Ids

**Precondition**:
Requires `EXECUTION_ADDR` and `EXECUTION_PORT` as well as the Executor to be warmed up on the Virtual Machine.
**Throws:** Does not throw directly. If the database is unreachable, the underlying rejection propagates. Callers should wrap in `try/catch`.

**Postcondition:** Executor returns information from the testcases or alerts execution failure.


