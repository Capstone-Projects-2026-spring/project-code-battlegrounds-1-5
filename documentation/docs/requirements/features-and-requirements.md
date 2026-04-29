---
sidebar_position: 4
---

# Features and Requirements

---

# Functional Requirements

## 1. Game Process

### 1.1 Game Modes
- The application must support two game modes: **2-player** (one team of two) and **4-player** (two teams of two competing against each other).
- Before entering matchmaking, users must select a difficulty level (**Easy**, **Medium**, or **Hard**) and a game mode. A problem matching the selected difficulty is randomly selected from the problem pool at match time.

### 1.2 Role Assignment
- Within each team, one player is assigned the **Coder** role and one is assigned the **Tester** role. In 2-player games, the first player to join the game room becomes the Coder; the second becomes the Tester. In 4-player games, each team follows the same rule independently.
- Role assignments are persisted in the database and used as the source of truth for both teams throughout the game.

### 1.3 Game Start
- Once the required number of players have joined the game room (2 for 2-player, 4 for 4-player), the server broadcasts a `gameStarting` event, waits 3 seconds, then starts a **5-minute countdown timer** by setting a Redis key with a 300,000 ms TTL.
- The timer is set atomically using a Redis `SET NX` operation to prevent double-starts in a clustered environment.
- All players receive a `gameStarted` event containing the remaining time in milliseconds and the total game duration.

### 1.4 Coder Responsibilities
- The Coder writes a solution in the shared Monaco editor. Every keystroke emits a `codeChange` event; the server persists the full editor content to Redis (key: `game:{teamId}:code`) and broadcasts it to the rest of the team in real time.
- Code content is limited to **10,000 characters**.
- The Coder can see test case results as they are run by the Tester, but cannot see the Tester's implementation details.

### 1.5 Tester Responsibilities
- The Tester writes unit test cases using a structured interface. Each test case defines function input parameters and an expected output value.
- The Tester can submit individual test cases for a dry run at any time using `submitTestCases`. The server forwards the request to the Executor service and returns results with `computedOutput` populated per case.
- Test case updates are synced to the full team in real time via `receiveTestCaseSync`.
- Chat messages between teammates are limited to **1,000 characters** and the last **50 messages** per team are persisted in Redis.

### 1.6 Role Swap
- At a randomly determined point between **30% and 70%** of the way through the 5-minute game duration, roles are swapped. The exact swap time is chosen at game start using `Math.random() * (0.7 - 0.3) + 0.3`.
- **60 seconds before** the swap, all players in the room receive a `roleSwapWarning` event so the UI can show a countdown.
- At the swap time, players receive `roleSwapping`. After a **2,500 ms** delay (to allow for frontend animation), the database is updated: `CODER → SPECTATOR`, `TESTER → CODER`, `SPECTATOR → TESTER`. Players then receive a `roleSwap` event and must re-fetch their role.
- In a clustered deployment, a distributed Redis lock (`SET NX PX 5000`) ensures only one server instance performs the DB update and emits the events.

### 1.7 Code Submission and Scoring
- Either player may submit the team's final code at any time using `submitCode`. On submission:
  - The submitted code is saved to the database.
  - The server fetches the team's persisted test cases from Redis and the problem's hidden test cases from the database.
  - Code is executed against all test cases (player-written and hidden) via the Executor service.
  - Results (`passed`, `actual`, `stderr`, `execution_time_ms`) are upserted to `GameTest` records in the database.
  - All Redis game timers are deleted (`game:{gameId}:expires`, `game:{gameId}:roleswap`, `game:{gameId}:roleswap:warning`) so no further expiration events fire.
  - The `GameRoom` status is set to `FINISHED` in the database.
  - A `gameEnded` event is broadcast to all players in the room.
  - All players are removed from their Socket.IO rooms and the sandbox VM is deleted.
- In a **4-player game**, the game does not end until both teams have submitted. The first team to submit receives a `waitingForOtherTeam` event. When the second team submits, both teams' code is executed in parallel (`Promise.all`) before teardown.

### 1.8 Timer Expiry
- If no team submits before the 5-minute timer expires, the Expiration Listener receives the Redis key expiry event for `game:{gameId}:expires`.
- The server sets `GameRoom.status = FINISHED` in the database, removes the game from the `activeGames` Redis set, and broadcasts `gameEnded` to all players.
- No automatic code execution is performed on timer expiry; the game ends with whatever test results were last persisted.

---

## 2. Coding Questions

- The application must include a persistent library of coding problems, each tagged with one of three difficulty levels: **Easy**, **Medium**, or **Hard**.
- Problems must cover at least the following categories: Strings, Arrays, Trees, Math, and Data Structures & Algorithms.
- Each problem must define a function signature, a set of visible test cases (used by players during the game), and a set of hidden test cases (used for final scoring only). Hidden tests are stored in the `ProblemTest` table and are never surfaced to players during gameplay.
- A random problem matching the selected difficulty is assigned to the game room at match formation time. The same problem is shared by both teams in a 4-player game.

---

## 3. Matchmaking

### 3.1 Solo Queue
- A user who is not in a party must select a game mode and difficulty, then emit `joinQueue`. The server adds them to the Redis list `queue:{gameType}:{difficulty}`.
- Matching is **first-in, first-out** within the same game mode and difficulty bucket. No skill-based or ELO-based matching is applied.
- When the required number of players is present (2 for 2-player, 4 for 4-player), the server atomically pops all required entries using a Lua script (`popAndMatch.lua`) in a single Redis operation, creates the `GameRoom` in the database, and emits `matchFound` to each matched player's socket.
- A player who is already in the queue for a given game mode and difficulty will receive `{ status: 'already_queued' }` if they attempt to join the same queue again.
- A player may leave the queue at any time by emitting `leaveQueue`. On socket disconnect, the server automatically removes the user from all queue keys across all game modes and difficulties.

### 3.2 Party Queue
- Two players may form a party before entering matchmaking. A party consists of exactly 2 players: an **owner** and one **member**.
- A player can invite another by emitting `partyInvite { toUserId }`. The invite is stored in Redis at `party:invite:{toUserId}` with a **60-second TTL** and delivered to the invitee's socket via `partyInviteReceived`. The invitee may accept (`partyInviteAccept`) or decline (`partyInviteDecline`).
- Alternatively, a player may join a party directly using the owner's party ID as a code via `partyJoinByCode`.
- For **2-player games**, a full party bypasses the queue entirely and forms an instant game room without waiting for other players.
- For **4-player games**, the party is pushed to the standard queue as a single entry worth 2 player slots. It is matched against other solo players or parties until 4 total player slots are filled.
- The owner may kick the member (`partyKick`) at any time before a game starts. The member may leave voluntarily (`partyLeave`).

---

## 4. Account Management

### 4.1 Sign Up and Sign In
- Users must be able to create an account using **email and password** or via **OAuth** (Google, GitHub). Passwords are hashed before storage; plain-text passwords are never persisted.
- Email/password accounts require email verification before the account is active. A verification token is sent by email and expires after use.
- OAuth accounts are marked as email-verified automatically at creation.
- Upon successful authentication, a session token is issued as an **HttpOnly, Secure cookie**. The session is validated on every subsequent authenticated request.

### 4.2 Session Handling
- Sessions expire after a configured duration. An expired session results in a `401` response and a redirect to the sign-in page.
- On sign-out, the session record is deleted from the database and the cookie is cleared.

### 4.3 Socket Identity
- After signing in, the client connects to the WebSocket server and emits `register { userId }`. The server writes the mapping `socket:{userId} → socketId` to Redis. This mapping is used throughout matchmaking, invites, and in-game relay to send targeted events to specific users.
- The mapping is deleted from Redis when the socket disconnects.

### 4.4 Social Features
- Users may send, accept, and decline friend requests using a unique friend code. Accepted friendships are persisted in the database with status `ACCEPTED`.
- Friend request events (`friendRequestSent`, `friendRequestReceived`, `friendRequestAccepted`, `friendRequestDeclined`) are delivered in real time to both parties via their socket connections.

---

# Non-Functional Requirements

## 1. Security
- All authentication and session management must use **Better Auth**. Session tokens must be issued as `HttpOnly, Secure` cookies and validated server-side on every authenticated request.
- Passwords must be hashed using **bcrypt** before storage. Plain-text passwords must never be written to the database or logs.
- WebSocket event payloads must be validated using **Zod schemas** before any processing occurs. Invalid payloads must be rejected with an error event; they must not cause unhandled exceptions or partial state changes.
- Distributed Redis locks (`SET NX`) must be used for all operations where multiple server instances could concurrently act on the same game state (role swap, game end).

## 2. Performance
- Code execution by the Executor service must complete and return results in under **2 seconds** per submission under normal load.
- The sandbox VM for each game room must be pre-warmed via `POST /request-warm-vm` at match formation time so that the first execution request does not incur a cold-start penalty.
- The Redis-backed Socket.IO adapter must allow any server instance in a cluster to deliver events to any socket, regardless of which instance the socket is connected to.
- The Lua script used for queue matching (`popAndMatch.lua`) must execute as a single atomic Redis operation to prevent partial pops or race conditions when multiple server instances process the same queue simultaneously.

## 3. Reliability
- All game timer keys (`expires`, `roleswap`, `roleswap:warning`) must be set using `SET NX` to ensure exactly-once initialization even under concurrent join events.
- When a game ends (either via submission or timer expiry), all associated Redis keys must be deleted and the game room status must be set to `FINISHED` in the database before the `gameEnded` event is emitted to clients.
- On socket disconnect, the server must remove the user from all matchmaking queues and delete the `socket:{userId}` Redis key to prevent stale socket mappings from being used in future lookups.

## 4. Usability
- Players must receive clear feedback for all state transitions: queue entry (`queueStatus`), match formation (`matchFound`), game start (`gameStarting` → `gameStarted`), role swap approach (`roleSwapWarning` 60 seconds before), role swap execution (`roleSwapping` → `roleSwap`), and game end (`gameEnded`).
- Late-joining or reconnecting players must receive the current code state (`receiveCodeUpdate`) and chat history (`receiveChatHistory`) immediately on joining their team room, sourced from Redis.