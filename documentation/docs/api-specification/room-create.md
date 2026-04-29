---
title: Room Create API
description: Room create to start the game
sidebar_position: 4
hide_table_of_contents: true
---

# Room Create API - `src/pages/api/room/create.ts`

`POST /api/room/create`. Creates a game room

### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

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