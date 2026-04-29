---
sidebar_position: 5
title: API
---

# API specifications

## Question API — `src/pages/api/question.ts`

`GET /api/question`. Returns one question from an in-memory cache loaded from `public/dataset.csv` on first call. Filters are ANDed together. Returns a random match from all qualifying rows.

---

### `Question` interface

| Field | Type | Description |
|---|---|---|
| `id` | `number` | Zero-based CSV row index. |
| `questionId` | `number` | LeetCode question ID. |
| `title` | `string` | Question title. |
| `slug` | `string` | URL-safe identifier (e.g. `"two-sum"`). Unique. |
| `text` | `string` | Problem statement, whitespace-trimmed. |
| `topics` | `string[]` | Topic tags. May be empty. |
| `difficulty` | `"Easy" \| "Medium" \| "Hard"` | Difficulty level. |
| `successRate` | `number` | Accepted / total submissions (0–1). |
| `totalSubmissions` | `number` | Total submission count. |
| `totalAccepted` | `number` | Total accepted submission count. |
| `likes` | `number` | Upvote count. |
| `dislikes` | `number` | Downvote count. |
| `likeRatio` | `number` | likes / (likes + dislikes). |
| `hints` | `string[]` | Hints. May be empty. |
| `similarQuestionIds` | `number[]` | `questionId`s of related questions. May be empty. |
| `similarQuestionTitles` | `string[]` | Titles matching `similarQuestionIds` order. May be empty. |

---

### Module-level state

| Name | Type | Description |
|---|---|---|
| `cachedQuestions` | `Question[] \| null` | `null` until first call to `loadQuestions()`. Write-once — never modified after population. |

---

### Functions

#### `loadQuestions(): Promise<Question[]>` *(private)*

Parses `public/dataset.csv` into `Question[]` and caches the result. Returns the cached array on subsequent calls without re-reading the file.

**Preconditions:**
- `public/dataset.csv` exists at `process.cwd()/public/dataset.csv`.
- CSV has a header row as row 1 (skipped via `from_line: 2`).
- Columns must be in the declared order.

**Postconditions:**
- Returns the same array reference on every call after the first.
- Rows with parse errors are silently skipped (`skipRecordsWithError: true`).

**Throws:**
- Node.js `Error` (`ENOENT`, `EACCES`, etc.) if the file does not exist or cannot be read.
- Rejects if the CSV stream itself errors (malformed file).

---

#### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

**Method:** `GET` only. Returns `405` for any other method.

##### Query parameters

| Param | Type | Filter applied |
|---|---|---|
| `id` | `string?` | `question.questionId === Number(id)` |
| `slug` | `string?` | `question.slug === slug` (exact match) |
| `difficulty` | `string?` | `question.difficulty` case-insensitive match against `"Easy"`, `"Medium"`, or `"Hard"` |
| `topic` | `string?` | Any topic tag contains `topic` (case-insensitive substring) |

**Returns:** `{ question: Question }` — one randomly selected match.

**Preconditions:**
- At least one question must match the filter set, or no filters are provided.

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `405` | Non-GET request | `{ error: "Method not allowed" }` |
| `404` | No questions match filters | `{ error: "No questions match the given filters" }` |
| `500` | `loadQuestions()` rejected | `{ error: "Failed to load questions" }` (also logs to `console.error`) |

**Examples:**

```
GET /api/question
-> 200 { question: { questionId: 1, title: "Two Sum", ... } }

GET /api/question?difficulty=Hard&topic=graph
-> 200 { question: { ... } }

GET /api/question?id=9999
-> 404 { error: "No questions match the given filters" }

POST /api/question
-> 405 { error: "Method not allowed" }
```

---

## Party API - `src/pages/api/party.ts`

`PUT /api/party`. Creates new party id and updates the party with that.

`GET /api/party`. Gets party members that are currently in party. Used for reconnect.

#### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

**Method:** `PUT` and `GET` only. Returns `405` for any other method.

**Returns:** `{ newId }` or `{ partyMember, joinedParty, partyCode }`

**Preconditions:**
- Must be signed in

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `405` | Non-GET or Non-PUT request | `{ error: "Method not allowed" }` |
| `401` | Not authorized | `{ error: "Not authorized" }` |

**Examples:**

```

GET /api/party
-> 200 { partyMember, joinedParty, partyCode }

PUT /api/party
-> 200 { newId }

POST /api/party
-> 405 { error: "Method not allowed" }
```

---

## Friend API - `src/pages/api/friend.ts`

`PUT /api/friend`. Creates new friend code and updates the user with that.

`GET /api/friend`. Gets friends on initial connection.

#### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

**Method:** `PUT` and `GET` only. Returns `405` for any other method.

**Returns:** `{ newFriendCode }` or `{ friends, friendRequests, friendCode }` 

**Preconditions:**
- Must be signed in

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `405` | Non-GET or Non-PUT request | `{ error: "Method not allowed" }` |
| `401` | Not authorized | `{ error: "Not authorized" }` |

**Examples:**

```

GET /api/friend
-> 200 { friends, friendRequests, friendCode }

PUT /api/friend
-> 200 { newFriendCode }

POST /api/friend
-> 405 { error: "Method not allowed" }
```

---

## Team Join API - `src/pages/api/team/join.ts`

`POST /api/team/join`. Joins team

#### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

**Method:** `POST` only. Returns `405` for any other method.

**Query** `{ userId, gameRoomId, teamId } = req.body;`

**Returns:** `{ role, playerCount }` 

**Preconditions:**
- Must be signed in
- A game must have been created before calling this api

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `405` | Non-GET or Non-PUT request | `{ error: "Method not allowed" }` |
| `401` | Not authorized | `{ error: "Not authorized" }` |
| `500` | Failed to create/update database | `{ message: 'Failed to create game room' }` |

**Examples:**

```

GET /api/team/join
-> 405 { error: "Method not allowed" }

POST /api/team/join
-> 201 { role, playerCount }
```

---

## Room Create API - `src/pages/api/room/create.ts`

`POST /api/room/create`. Creates a game room

#### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

**Method:** `POST` only. Returns `405` for any other method.

**Query** `{ difficulty, gameType } = req.body;`

**Returns:** `{ gameId }` 

**Preconditions:**
- Must be signed in

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `405` | Non-GET or Non-PUT request | `{ error: "Method not allowed" }` |
| `401` | Not authorized | `{ error: "Not authorized" }` |
| `500` | Failed to create/update database | `{ message: 'Failed to create game room' }` |

---

## Room Details API - `src/pages/api/room/[gameId].ts`

`GET /api/room/[gameId]`. Gets all information needed for the game state

#### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

**Method:** `GET` only. Returns `405` for any other method.

**Query** `{ gameId } = req.body;`

**Returns:** `{ problem, gameType, status, teams, teamId, role }` 

**Preconditions:**
- Must be signed in
- Game must have been created

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `405` | Non-GET or Non-PUT request | `{ error: "Method not allowed" }` |
| `401` | Not authorized | `{ error: "Not authorized" }` |
| `500` | Failed to create/update database | `{ message: 'Failed to create game room' }` |

---

## Results API - `src/pages/api/results/[gameId].ts`

`GET /api/results/[gameId]`. Gets all information needed from the game for results

#### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

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