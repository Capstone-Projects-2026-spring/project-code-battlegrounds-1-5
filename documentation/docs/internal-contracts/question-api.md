---
sidebar_position: 5
title: Question API
---

# Question API — `src/pages/api/question.ts`

`GET /api/question`. Returns one question from an in-memory cache loaded from `public/dataset.csv` on first call. Filters are ANDed together. Returns a random match from all qualifying rows.

---

## `Question` interface

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

## Module-level state

| Name | Type | Description |
|---|---|---|
| `cachedQuestions` | `Question[] \| null` | `null` until first call to `loadQuestions()`. Write-once — never modified after population. |

---

## Functions

### `loadQuestions(): Promise<Question[]>` *(private)*

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

### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

**Method:** `GET` only. Returns `405` for any other method.

#### Query parameters

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
