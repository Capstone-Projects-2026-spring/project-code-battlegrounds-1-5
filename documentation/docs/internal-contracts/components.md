---
sidebar_position: 3
title: UI Components
---

# UI Components

This document captures the public contract for reusable UI components that own app-level state, socket behavior, or core UI flows.

---

## Navigation and shell

### `HeaderSimple` — `src/components/Navbar.tsx`

Top navigation bar with a brand, optional spectator label, and avatar button that opens the side panel.

**Props (`HeaderProps`)**

| Prop | Type | Description |
|---|---|---|
| `links` | `string[]` | Nav link labels. `links[0]` is the initial active link. **Must not be empty**. |
| `title` | `string \| undefined` | Displayed on the left side of the header (split by `|` internally). |
| `isSpectator` | `boolean?` | When true, shows a `(Spectating)` label. |

**Behavior**
- Clicking a link prevents navigation and only updates the visual active state.
- Avatar button opens `SidePanel`.

---

### `SidePanel` — `src/components/sidebar/SidePanel.tsx`

Right-side drawer that hosts `PartyBox`.

| Prop | Type | Description |
|---|---|---|
| `opened` | `boolean` | Drawer open state. |
| `onClose` | `() => void` | Close handler. |

---

### `PartyBox` — `src/components/sidebar/PartyBox.tsx`

Wraps party slots, friend list, and invite list. Uses `PartyContext` and `FriendshipContext`.

**Behavior**
- Renders `PartySlots` and tabbed friend/invite lists.
- Provides a sign-out button that calls `authClient.signOut()` and redirects to `/login`.

---

### `PartySlots` — `src/components/sidebar/PartySlots.tsx`

Visual party roster + join-by-code flow.

**Behavior**
- Owner view can copy/reset party code and kick guests.
- Guest view can leave the party.
- Join-by-code emits `partyJoinByCode` and waits for `partyJoined`.
- Emits `partyKick`/`partyLeave` for owner/guest actions.

---

### `FriendsTab` — `src/components/sidebar/FriendsTab.tsx`

Friend roster with invite and delete actions.

**Behavior**
- Emits `partyInvite` to invite online friends (disabled if party full/offline).
- Emits `friendDelete` and updates local list.
- Sorted by presence (`online` -> `away` -> `offline`).

---

### `InvitesTab` — `src/components/sidebar/InvitesTab.tsx`

Pending party invites + friend requests.

**Behavior**
- Emits `partyInviteAccept`/`partyInviteDecline` and clears pending state.
- Emits `friendRequestAccept`/`friendRequestDecline` and clears friend request state.

---

### `AddFriendBox` — `src/components/sidebar/AddFriendBox.tsx`

Friend request input with copy/reset friend code support.

**Behavior**
- Emits `friendRequest` and waits for `friendRequestSent`.
- Uses `/api/friends` `PUT` to rotate the friend code.

---

## Matchmaking and home

### `FindLobbySection` — `src/components/home/FindLobbySection.tsx`

Matchmaking queue UI. Drives queue state using `MatchmakingContext` + `PartyContext`.

**Behavior**
- Emits `updateQueueSelection` (party sync), `joinQueue`, and `leaveQueue`.
- Displays queue status and match found state.

---

### `DifficultySection` — `src/components/home/DifficultySection.tsx`

Instant room creation UI.

**Behavior**
- Calls `/api/rooms/create` via `useCreateRoom`.
- Emits `sendGameWithParty` when a party guest should be joined to the new room.

---

### `JoinGameSection` — `src/components/home/JoinGameSection.tsx`

Join-by-ID input. Redirects to `/game/[gameID]` without validation beyond non-empty.

---

### Home sections — `src/components/home/*`

`HeroSection`, `HowItWorksSection`, `LiveDemoSection`, and `CTASection` render the marketing flow and emit PostHog events for CTA interactions.

---

## Game room

### `TeamSelect` — `src/components/TeamSelect.tsx`

Team selection UI for the game room.

| Prop | Type | Description |
|---|---|---|
| `userId` | `string` | Current user ID. |
| `teams` | `TeamCount[]` | Team IDs + player counts. |
| `gameRoomId` | `string` | Game room identifier for display and join calls. |
| `onJoined` | `(teamId, role, playerCount) => void` | Called after `/api/team/join` succeeds. |

---

### `ProblemBox` — `src/components/ProblemBox.tsx`

Problem statement viewer with optional hide button.

| Prop | Type | Description |
|---|---|---|
| `problem` | `ActiveProblem \| null` | Problem metadata from `/api/rooms` or results. |
| `onToggleVisibility` | `() => void` | Optional callback to hide the panel. |

---

### `ChatBox` — `src/components/ChatBox.tsx`

Team chat panel backed by Socket.IO.

| Prop | Type | Description |
|---|---|---|
| `socket` | `Socket` | Active socket connection. |
| `roomId` | `string` | Team room ID. |
| `userName` | `string` | Display name for outbound messages. |
| `isSpectator` | `boolean?` | Disables sending when true. |
| `role` | `Role \| null` | Optional analytics tag. |

**Behavior**
- Emits `requestChatSync` on mount.
- Listens for `receiveChatHistory` and `receiveChat`.
- Emits `sendChat` for outbound messages and mirrors them locally for instant UI updates.

---

### `GameTimer` — `src/components/GameTimer.tsx`

Countdown timer for the match. Exposes `getTimeRemainingDisplay()` via a ref for submission metadata.

---

### `RoleFlipPopup` — `src/components/RoleFlipPopup.tsx`

Modal shown while the game is in `FLIPPING` state.

---

### `GameTestCase` — `src/components/gameTests/GameTestCase.tsx`

Single test case editor for testers.

**Behavior**
- Emits `submitTestCases` for single-case runs.
- Uses `computedOutput` to display executor results.

---

### `NewParameterButton` — `src/components/gameTests/NewParameterButton.tsx`

Popover form for creating new input parameters.

---

## Results

### `AnalysisBox` — `src/components/Analysisbox.tsx`

Side-by-side code and runtime metrics from results API.

---

### `TestCaseResultsBox` — `src/components/TestCaseResultsBox.tsx`

Tabular test results viewer for scoring tests and game-made tests. Computes pass/fail by parsing output types and can report a summary via `onSummaryChange`.
