---
title: Friend API
description: Api to get friends info and change friend id
sidebar_position: 1
hide_table_of_contents: true
---

# Friend API - `src/pages/api/friend.ts`

`PUT /api/friend`. Creates new friend code and updates the user with that.

`GET /api/friend`. Gets friends on initial connection.

### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

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
