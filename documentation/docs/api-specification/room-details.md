---
title: Room Details API
description: Room details to get the game state
sidebar_position: 5
hide_table_of_contents: true
---

# Room Details API - `src/pages/api/room/[gameId].ts`

`GET /api/room/[gameId]`. Gets all information needed for the game state

### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

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