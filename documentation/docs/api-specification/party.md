---
title: Party API
description: Api to get party info and change party id
sidebar_position: 2
hide_table_of_contents: true
---

# Party API - `src/pages/api/party.ts`

`PUT /api/party`. Creates new party id and updates the party with that.

`GET /api/party`. Gets party members that are currently in party. Used for reconnect.

### `handler(req: NextApiRequest, res: NextApiResponse): Promise<void>`

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