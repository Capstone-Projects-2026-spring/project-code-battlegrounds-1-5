---
title: Team Join API
description: API to join a team
sidebar_position: 6
hide_table_of_contents: true
---


# Team Join API - `src/pages/api/team/join.ts`

`POST /api/team/join`. Joins team

### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

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
