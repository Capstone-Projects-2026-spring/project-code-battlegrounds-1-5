---
sidebar_position: 7
title: WebSocket Events
---

# WebSocket Event Protocol

Socket.IO, same origin as Next.js. Client connects with `io()` (no args). Server defined in `server/index.js`. Redis-backed for cluster-aware rooms and code/chat/test-case state persistence.

**Server entry point:** `server/index.js` → `initSocket()` → `registerSocketHandlers()` which fans out to four handler modules: `gameHandlers`, `executionHandlers`, `matchmakingHandlers`, `inviteHandlers`.

---

## Shared Types

```typescript
type Role = 'coder' | 'tester' | 'spectator';
type GameType = 'TWOPLAYER' | 'FOURPLAYER';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface Message {
  id: string;        // e.g. Math.random().toString(36).substring(7)
  text: string;      // message body (max 1000 chars)
  userName: string;  // sender display name
  timestamp: number; // unix ms
}

type ParameterPrimitive =
  | 'string' | 'number' | 'boolean'
  | 'array_string' | 'array_number'
  | 'array_array_string' | 'array_array_number';

interface Parameter {
  name: string;
  type: ParameterPrimitive;
  value: string | null;
  isOutputParameter?: boolean;
}

interface TestableCase {
  id: number;
  functionInput: Parameter[];
  expectedOutput: Parameter;
  computedOutput?: string | null;
}
```

---

## Connection Setup

Socket.IO is initialised with a Redis adapter for cluster support. CORS origin is read from `BETTER_AUTH_URL`. Ping settings are configured for long-lived game sessions.

```
pingInterval:  5,000 ms
pingTimeout:   1,800,000 ms (30 min)
```

> **Auth middleware:** A session-cookie auth middleware exists in `socket/index.js` but is currently commented out. Sockets are not authenticated at the transport layer; identity is established later via the `register` event.

---

## Client → Server Events

### `register`

Associate the connected socket with a user account. Must be emitted before any event that relies on `socket.userId`.

```typescript
socket.emit('register', { userId: string });
```

**Server behavior:** Stores `socket:{userId} → socketId` in Redis and sets `socket.userId` on the socket instance. Emits `matchFound` if there is an active game involving the user.

---

### `joinLobby`

Join the pre-game lobby room for a game. Used to receive `teamUpdated` broadcasts before the game starts.

```typescript
socket.emit('joinLobby', { gameId: string });
```

**Server behavior:** Adds the socket to the `{gameId}:lobby` room and acknowledges with `joinedLobby`.

---

### `joinGame`

Join the active game room and team room. Triggers game start logic if enough players are present.

```typescript
socket.emit('joinGame', {
  gameId:   string,
  teamId:   string,
  gameType: GameType,
});
```

| Field | Type | Description |
|---|---|---|
| `gameId` | `string` | The game room identifier. |
| `teamId` | `string` | The team room identifier. |
| `gameType` | `GameType` | `'TWOPLAYER'` or `'FOURPLAYER'`. |

**Server behavior:**

1. Joins `gameId` and `teamId` rooms; leaves `{gameId}:lobby`.
2. Counts sockets in `gameId`.
3. Checks `isGameStarted(gameId)` — queries `EXISTS game:{gameId}:expires` in Redis.
4. **If game already started** (late joiner): emits `gameStarted` with the current remaining TTL back to this socket only.
5. **If player count hits the threshold** (2 for TWOPLAYER, 4 for FOURPLAYER): broadcasts `gameStarting` to the room, then after `delayMs` (default 3 s) calls `startGameIfNeeded`, which atomically sets three Redis timer keys and adds the game to `activeGames`. Broadcasts `gameStarted` to the whole room.
6. Fetches `game:{teamId}:code` from Redis. If present, emits `receiveCodeUpdate` to this socket only.

**Redis keys set by `startGameIfNeeded`:**

| Key | TTL | Purpose |
|---|---|---|
| `game:{gameId}:expires` | `GAME_DURATION_MS` (5 min) | Main game timer |
| `game:{gameId}:roleswap` | `GAME_DURATION_MS × rand(0.3–0.7)` | Role-swap trigger |
| `game:{gameId}:roleswap:warning` | `roleswap TTL − 60 s` | Warning before role swap |

All three keys use `SET … NX` to prevent double-starts in a clustered environment.

---

### `codeChange`

Send updated editor content. Emitted by the coder on every keystroke.

```typescript
socket.emit('codeChange', {
  teamId: string,
  code:   string,   // max 10,000 chars
});
```

**Server behavior:**

1. Validates payload with Zod.
2. Persists `code` to Redis at `game:{teamId}:code` (no TTL).
3. Broadcasts `receiveCodeUpdate` to all other sockets in the `teamId` room.

> Full editor content is sent on every keystroke — no debounce or diffing.

---

### `sendChat`

Send a chat message to the team room.

```typescript
socket.emit('sendChat', {
  teamId:  string,
  message: Message,
});
```

**Server behavior:**

1. Persists message to Redis list `chat:{teamId}` via `RPUSH`, then trims to the last 50 messages.
2. Broadcasts `receiveChat` to all other sockets in the `teamId` room.

---

### `requestChatSync`

Request the full persisted chat history for a team (used on reconnect / late join).

```typescript
socket.emit('requestChatSync', { teamId: string });
```

**Server behavior:** Reads `chat:{teamId}` list from Redis and emits `receiveChatHistory` back to the requesting socket only.

---

### `updateTestCases`

Push the current test case set to Redis and broadcast to teammates.

```typescript
socket.emit('updateTestCases', {
  teamId:    string,
  testCases: TestableCase[],
});
```

**Server behavior:** Saves `testCases` to Redis at `testcases:{teamId}` and broadcasts `receiveTestCaseSync` to other sockets in the `teamId` room.

---

### `requestTestCaseSync`

Fetch the latest persisted test cases and sync them to the whole team.

```typescript
socket.emit('requestTestCaseSync', { teamId: string });
```

**Server behavior:** Reads `testcases:{teamId}` from Redis. If found, emits `receiveTestCaseSync` to both the requesting socket and the rest of the team.

---

### `requestTeamUpdate`

Notify lobby sockets of the current player count for a team.

```typescript
socket.emit('requestTeamUpdate', {
  teamId:      string,
  gameId:      string,
  playerCount: number,
});
```

**Server behavior:** Broadcasts `teamUpdated` to the `{gameId}:lobby` room.

---

### `creatingRoomWithParty` / `sendGameWithParty`

Party-specific relay events. Used by the party owner to coordinate room creation with their partner.

```typescript
socket.emit('creatingRoomWithParty', { partyMember: string }); // userId
socket.emit('sendGameWithParty', { partyMember: string, gameId: string });
```

**Server behavior:** Looks up the party member's `socketId` from Redis and relays `creatingRoomFromHost` or `createdRoomFromHost` to them directly.

---

## Matchmaking Events (Client → Server)

### `joinQueue`

```typescript
socket.emit('joinQueue', {
  userId:     string,
  gameType:   GameType,
  difficulty: Difficulty,
  partyId?:   string | null,
  lobbyId?:   string | null,
});
```

**Server behavior:**

- If the user is already queued in this queue, returns `{ status: 'already_queued' }`.
- **TWOPLAYER + partyId:** skips the queue entirely and calls `_formPartyGame` for an instant match.
- Otherwise, pushes an entry to the Redis list `queue:{gameType}:{difficulty}` and attempts match formation via the `popAndMatch.lua` Lua script (atomic pop of N entries).
- On match: creates a `GameRoom` in DB, calls `warmVm(gameId)` to pre-warm the sandbox, emits `matchFound` to each matched player's socket.
- Emits `queueStatus` back to the caller with `{ status: 'queued' | 'matched' | 'already_queued', gameId? }`.

> The Lua script handles party entries (worth 2 players) and solo entries (worth 1) atomically, preventing partial pops.

---

### `leaveQueue`

```typescript
socket.emit('leaveQueue', { gameType: GameType, difficulty: Difficulty });
```

**Server behavior:** Scans the Redis list and removes the entry matching `socket.userId`. Emits `queueStatus`.

---

### `updateQueueSelection`

Relays the current game type/difficulty selection to a party member's socket so their UI stays in sync.

```typescript
socket.emit('updateQueueSelection', {
  gameType:    GameType,
  difficulty:  Difficulty,
  partyMember: { userId: string },
});
```

---

### `partySearch`

Relays the party owner's search state (searching/idle) to their partner.

```typescript
socket.emit('partySearch', {
  partyMember: { userId: string },
  state:       boolean,
});
```

---

## Invite / Social Events (Client → Server)

### Party Events

| Event | Payload | Description |
|---|---|---|
| `partyInvite` | `{ toUserId: string }` | Send a party invite. Stored in Redis at `party:invite:{toUserId}` with 60 s TTL. |
| `partyInviteAccept` | *(none)* | Accept the pending invite; joins the party in DB. |
| `partyInviteDecline` | *(none)* | Decline and delete the invite from Redis. |
| `partyKick` | *(none)* | Owner kicks the current party member. |
| `partyLeave` | *(none)* | Member leaves the party. |
| `partyJoinByCode` | `{ code: string }` | Join a party directly by its ID/code (max 10 chars). |

---

### Friend Events

| Event | Payload | Description |
|---|---|---|
| `friendRequest` | `{ friendCode: string }` | Send a friend request by friend code (max 20 chars). |
| `friendRequestAccept` | `{ requestId: string }` | Accept a pending friend request. |
| `friendRequestDecline` | `{ requestId: string }` | Decline a pending friend request. |
| `friendDelete` | `{ exFriendId: string, friendId: string }` | Remove a friendship record. |

---

## Server → Client Events

### Game Events

| Event | Payload | Description |
|---|---|---|
| `joinedLobby` | *(none)* | Acknowledgement after `joinLobby`. |
| `teamUpdated` | `{ teamId, playerCount }` | Broadcast to lobby when player count changes. |
| `gameStarting` | *(none)* | Broadcast to room when the player threshold is met. Countdown begins. |
| `gameStarted` | `{ start: number, _duration: number }` | Broadcast when timers are set. `start` = remaining ms; `_duration` = total game ms. |
| `receiveCodeUpdate` | `code: string` | Sent to team room on `codeChange`, or to joining socket if code exists in Redis. |
| `receiveChat` | `message: Message` | Broadcast to team room on `sendChat`. Excludes sender. |
| `receiveChatHistory` | `Message[]` | Unicast to requesting socket on `requestChatSync`. |
| `receiveTestCaseSync` | `TestableCase[]` | Sent to team room (or socket) on test case update or sync. |
| `waitingForOtherTeam` | *(none)* | Sent to a FOURPLAYER team after they submit while waiting for the other. |
| `gameEnded` | *(none)* | Broadcast to room when the game concludes (submit or timer expiry). |

---

### Role Events (from ExpirationListener)

These are emitted by the server when Redis timer keys expire, not in response to a client event.

| Event | Emitted to | Description |
|---|---|---|
| `roleSwapWarning` | `gameId` room | Fired when `game:{id}:roleswap:warning` expires (~60 s before swap). Show a countdown UI. |
| `roleSwapping` | `gameId` room | Fired immediately when `game:{id}:roleswap` expires. Animate the transition. |
| `roleSwap` | each `teamId` room | Fired ~2.5 s after `roleSwapping`, after DB roles have been updated. Clients should re-fetch their role. |

**Role swap DB logic (runs inside distributed lock):**

```
CODER    → SPECTATOR
TESTER   → CODER
SPECTATOR → TESTER
```

---

### Matchmaking Events

| Event | Payload | Description |
|---|---|---|
| `queueStatus` | `{ status, gameId? }` | Result of `joinQueue` or `leaveQueue`. `status` is `queued`, `matched`, `already_queued`, or `removed`. |
| `matchFound` | `{ gameId: string }` | Unicast to each matched player's socket when a full match is formed. |
| `receiveQueueSelection` | `{ gameType, difficulty }` | Unicast to party member when the owner changes their queue selection. |
| `partySearchUpdate` | `{ state: boolean }` | Unicast to party member reflecting owner's searching state. |

---

### Invite / Social Events

| Event | Payload | Sent to | Description |
|---|---|---|---|
| `partyInviteReceived` | `{ fromUserId, fromDisplayName, fromAvatarUrl, partyOwnerId, sentAt }` | invitee socket | Invite received. |
| `partyJoined` | `owner: { userId, username, displayName, avatarUrl, joinedAt }` | accepting/joining socket | Confirmed party membership. |
| `partyMemberJoined` | `member: { userId, username, displayName, avatarUrl, joinedAt }` | owner socket | Someone joined the party. |
| `joinedPartyLeft` | *(none)* | kicked member socket | Member was kicked; reset party UI. |
| `partyMemberLeft` | *(none)* | owner socket | Member left voluntarily. |
| `friendRequestSent` | outgoing request object | sender socket | Confirms outgoing request; update list. |
| `friendRequestReceived` | incoming request object | addressee socket | New incoming friend request. |
| `friendRequestAccepted` | friend object | both sockets | Friendship confirmed; update friends list. |
| `friendRequestDeclined` | `{ requestId }` | requester socket | Notifies requester of decline. |
| `friendDeleted` | `{ friendId }` | ex-friend socket | Notifies the other party of removal. |
| `creatingRoomFromHost` | *(none)* | party member socket | Owner is in the process of creating the room. |
| `createdRoomFromHost` | `{ gameId }` | party member socket | Owner created the room; member should navigate to it. |

---

## Disconnect

```typescript
socket.on('disconnect', async () => { ... });
```

On disconnect:
1. Logs the disconnection with `socket.id`.
2. Deletes `socket:{userId}` from Redis via `cleanupSocket`.
3. Calls `leaveAllQueues(userId)` to remove the user from every matchmaking queue across all game types and difficulties.

Socket.IO automatically removes the socket from all rooms. No further app-level cleanup occurs.

---

## Server-Side State (Redis)

| Key pattern | Type | Value | Written by | Read by | TTL |
|---|---|---|---|---|---|
| `game:{gameId}:expires` | string | `'1'` | `startGameIfNeeded` | `isGameStarted`, ExpirationListener | `GAME_DURATION_MS` (5 min) |
| `game:{gameId}:roleswap` | string | `'1'` | `startGameIfNeeded` | ExpirationListener | `GAME_DURATION_MS × rand(0.3–0.7)` |
| `game:{gameId}:roleswap:warning` | string | `'1'` | `startGameIfNeeded` | ExpirationListener | `roleswap TTL − 60 s` |
| `game:{teamId}:code` | string | editor content | `codeChange` handler | `joinGame` handler | None |
| `chat:{teamId}` | list | `Message[]` (max 50) | `sendChat` handler | `requestChatSync` handler | None |
| `testcases:{teamId}` | string (JSON) | `TestableCase[]` | `updateTestCases` handler | `requestTestCaseSync`, `submitCode` | None |
| `game:{roomId}:submissions` | string (JSON) | `{ team1?, team2? }` | `submitCode` handler | `submitCode` handler | None (deleted on game end) |
| `socket:{userId}` | string | `socketId` | `register` event | matchmaking, invites, game relay | None |
| `party:invite:{toUserId}` | string (JSON) | invite object | `partyInvite` handler | `partyInviteAccept/Decline` | 60 s |
| `queue:{gameType}:{difficulty}` | list | entry objects | `joinQueue` | `_tryFormMatch` (Lua), `leaveQueue` | None |
| `activeGames` | set | `gameId` strings | `startGameIfNeeded` | ExpirationListener | None |
| `lock:game:{gameId}:roleswap` | string | `'1'` | ExpirationListener | ExpirationListener | 5 s |
| `lock:game:{gameId}:end` | string | `'1'` | ExpirationListener | ExpirationListener | 5 s |

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Zod validation failure on any event | `socket.emit('error', { message: '...' })`, handler returns early. |
| Redis down during `joinGame` code fetch | `console.error`. Socket still joins; no code sent. |
| Redis down during `codeChange` persist | `console.error`. Code still broadcast; not persisted for late joiners. |
| Executor service unreachable | `console.error`, `socket.emit('error', { message: '...' })`. Game not ended. |
| `submitCode` with no matching `GameResult` | `socket.emit('error', { message: 'Game or result not found' })`. |
| FOURPLAYER: one team's execution fails | Logs error; emits `error` to socket; game **not** finalized. |
| `socket.userId` missing on invite/matchmaking events | Handler returns early silently. |
| Distributed lock not acquired (roleswap/end) | Handler returns early — another cluster instance is handling it. |
| Game not in `activeGames` on expiry | Handler returns early — game already ended via `submitCode`. |
| Client disconnect | `cleanupSocket` + `leaveAllQueues`. Socket.IO removes from all rooms automatically. |
| No socket found for a userId lookup | Skips room-leave or notification; logs warning. |