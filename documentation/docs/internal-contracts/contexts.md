---
sidebar_position: 4
title: Frontend Context Providers
---

# Frontend Context Providers

Context modules live in `src/contexts` and are responsible for cross-page state and socket lifecycle glue. Global providers are composed in `_app.tsx`. Game-only providers are created inside the game room page.

## Provider composition

- **App shell:** `SocketProvider` -> `PartyProvider` -> `MatchmakingProvider` -> `FriendshipProvider`
- **Game room only:** `GameStateProvider` -> `GameTestCasesProvider`

---

## `SocketContext` — `src/contexts/SocketContext.tsx`

**Purpose**
- Owns the singleton Socket.IO connection for the client.

**State**
| Field | Type | Description |
|---|---|---|
| `socket` | `Socket \| undefined` | Live Socket.IO client instance, set after the session loads. |
| `setSocket` | `Dispatch<SetStateAction<Socket \| undefined>>` | Manual override; used only internally. |

**Behavior**
- Waits for `authClient.useSession()` to return a user ID before creating the socket.
- Connects using `io({ autoConnect: true })` and emits `register` on connect.
- Listens for `error` events and forwards messages through `showErrorNotification`.
- Disconnects on unmount and clears `socket` state.

---

## `MatchmakingContext` — `src/contexts/MatchmakingContext.tsx`

**Purpose**
- Shared state for queueing, difficulty selection, and match resolution.

**State**
| Field | Type | Description |
|---|---|---|
| `status` | `"idle" \| "queued" \| "matched" \| "error"` | Queue state for the current user. |
| `gameType` | `GameType` | `TWOPLAYER` or `FOURPLAYER`. |
| `difficulty` | `ProblemDifficulty` | Selected difficulty for matchmaking. |
| `gameId` | `string \| undefined` | Set once a match is found or a room is created. |

**Socket events**
- Emits `register` when the socket is available and a session exists.
- Listens for:
  - `matchFound` -> redirects to `/game/[gameId]` and sets `status`.
  - `queueStatus` -> updates `status` or marks errors.
  - `receiveQueueSelection` -> syncs game type/difficulty for party guests.
  - `partySearchUpdate` -> syncs queue state for party guests.
  - `createdRoomFromHost` -> redirects guests to the host-created room.

---

## `PartyContext` — `src/contexts/PartyContext.tsx`

**Purpose**
- Tracks party membership, invites, and party join codes.

**State**
| Field | Type | Description |
|---|---|---|
| `partyMember` | `PartyMember \| null` | Party guest (for the owner) when a party is formed. |
| `joinedParty` | `PartyMember \| null` | The party owner record when the current user is the guest. |
| `pendingInvite` | `PartyInvite \| null` | Incoming party invite currently awaiting response. |
| `partyCode` | `string \| null` | Owner's party join code. |

**Behavior**
- On session load, fetches `/api/party` and hydrates the initial state.
- Listens for:
  - `partyMemberJoined` -> fills the guest slot for the owner.
  - `partyInviteReceived` -> sets `pendingInvite` and shows a notification with accept/decline actions.
  - `partyMemberLeft` -> clears the guest slot on the owner view.
  - `joinedPartyLeft` -> clears `joinedParty` when the guest is removed.
- Accept/decline actions emit `partyInviteAccept` / `partyInviteDecline` and clear local state.

---

## `FriendshipContext` — `src/contexts/FriendshipContext.tsx`

**Purpose**
- Stores friends, friend requests, and the user's friend code.

**State**
| Field | Type | Description |
|---|---|---|
| `friends` | `Friend[]` | Current friend list. |
| `friendRequests` | `FriendRequest[]` | All friend requests (incoming + outgoing). |
| `incomingRequests` | `FriendRequest[]` | Derived: `direction === "incoming"`. |
| `outgoingRequests` | `FriendRequest[]` | Derived: `direction === "outgoing"`. |
| `friendCode` | `string \| null` | User's invite code for adding friends. |

**Behavior**
- On session load, fetches `/api/friends` and hydrates friends + requests.
- Listens for:
  - `friendRequestReceived` -> adds an incoming request and opens an accept/decline notification.
  - `friendRequestAccepted` -> moves a request into `friends`.
  - `friendRequestDeclined` -> removes the request locally.
  - `friendDeleted` -> removes a friend from the list.

---

## `GameStateContext` — `src/contexts/GameStateContext.tsx`

**Purpose**
- Game-room scoped state: team identity, game identity, and shared code buffer.

**State**
| Field | Type | Description |
|---|---|---|
| `teamId` | `string \| undefined` | Team room ID once selected. |
| `gameId` | `string \| undefined` | Game room ID (URL param). |
| `gameType` | `GameType \| undefined` | Current game mode. |
| `code` | `string \| undefined` | Shared editor contents; defaults to a waiting placeholder. |

---

## `GameTestCasesContext` — `src/contexts/GameTestCasesContext.tsx`

**Purpose**
- Game-room scoped test cases and parameter definitions used by testers.

**State**
| Field | Type | Description |
|---|---|---|
| `parameters` | `ParameterType[]` | Input/output parameter schema for each test. |
| `cases` | `TestableCase[]` | Active test cases. Defaults to `DEFAULT_TEST_CASES`. |

**Helpers**
| Function | Description |
|---|---|
| `addCase(testCase)` | Appends a new test case. |
| `removeCase(id)` | Removes a test case by ID. |
| `updateCase(testCase)` | Replaces the test case with the same ID. |

**Defaults**
- Parameters start as `a`, `b`, and output `result` (output parameter).
- `DEFAULT_TEST_CASES` contains a single test with inputs `2` and `3` expecting `5`.
