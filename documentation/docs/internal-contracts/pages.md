---
sidebar_position: 3
title: Pages and Routes
---

# Pages and Routes

This app uses the Next.js Pages Router. Client-side navigation is handled with `next/router` and most pages gate access with `authClient.useSession()`.

## App shell

### `_app` — `src/pages/_app.tsx`

**Responsibilities**
- Registers Mantine theme + global styles and mounts `Notifications`.
- Boots PostHog analytics once on mount.
- Composes global context providers in this order: `SocketProvider` -> `PartyProvider` -> `MatchmakingProvider` -> `FriendshipProvider`.
- Restores the last active game by reading `localStorage.stored_game` and redirecting to `/game/[gameID]` if present.
- Hides the navbar on `/`, `/login`, and `/signup`.

### `_document` — `src/pages/_document.tsx`

**Responsibilities**
- Sets `<Html lang="en">` and Mantine color-scheme script.
- Defines the favicon for the base document.

## Public routes

### Home — `/` (`src/pages/index.tsx`)

- Uses dynamic imports for the hero, how-it-works, live demo, and CTA sections.
- If a session exists, shows an avatar button that opens the side panel.
- Sends the `homepage_viewed` PostHog event.

### Tutorial — `/tutorial` (`src/pages/tutorial.tsx`)

- Scroll-driven tutorial page that tracks visibility with `IntersectionObserver`.
- Sends the `tutorial_viewed` PostHog event.

### Login — `/login` (`src/pages/login.tsx`)

- Uses Mantine `useForm` for email + password.
- Calls `authClient.signIn.email`, then redirects to `/matchmaking` on success.
- Emits PostHog success/failure events and uses `showErrorNotification` on error.

### Signup — `/signup` (`src/pages/signup.tsx`)

- Uses Mantine `useForm` for name + email + password.
- Calls `authClient.signUp.email`, then redirects to `/matchmaking` on success.
- Emits PostHog success/failure events and uses `showErrorNotification` on error.

## Authenticated routes

### Matchmaking — `/matchmaking` (`src/pages/matchmaking.tsx`)

- Requires an active session; redirects to `/login` if unauthenticated.
- Uses `MatchmakingContext` + `PartyContext` to track queue state and party membership.
- Emits:
  - `joinQueue` / `leaveQueue` for matchmaking.
  - `partySearch` so party guests can mirror queue state.
- Renders two flows:
  - **Create Game** (`DifficultySection`) uses `/api/rooms/create` and optionally emits `sendGameWithParty`.
  - **Matchmaking** (`FindLobbySection`) updates queue selection and status.
- Optional join-by-id flow via `JoinGameSection`.

### Game room — `/game/[gameID]` (`src/pages/game/[gameID].tsx`)

**Auth and bootstrapping**
- Redirects to `/login` if unauthenticated.
- Wraps the room in `GameStateProvider` + `GameTestCasesProvider`.
- Fetches `/api/rooms/{gameId}/{userId}` to load the active problem, game type, and team/role info.
- Auto-joins the first team for 2-player games if no team is assigned.
- Saves the game ID to `localStorage.stored_game` so refreshes can resume.

**Socket flow (high level)**
- `joinGame` joins both the game room and team room.
- `codeChange`, `updateTestCases`, and chat events broadcast to the team room.
- `gameStarting`, `gameStarted`, `roleSwapWarning`, `roleSwapping`, `roleSwap`, and `gameEnded` drive the timer + role UI.
- `submitCode` finalizes a team submission; `submitTestCases` executes tester runs.

**UI behavior**
- Team selection UI (`TeamSelect`) gates entry when a player has no team.
- Spectators can toggle between team views (coder/tester POV) and have read-only editors.
- The Monaco editor is editable only for coders and only when not spectating.
- Test cases are limited to 5 total and can be added/removed by testers.

**Known gap**
- The page listens for an `invalidGame` socket event, but the server does not emit it.

### Results — `/results/[gameID]` (`src/pages/results/[gameID].tsx`)

- Requires an active session; redirects to `/login` if unauthenticated.
- Fetches results via `useGameResults` (`/api/results/{gameId}`).
- Computes scores using `calculateScorePair` and renders:
  - `AnalysisBox` for final code + runtime metrics.
  - `TestCaseResultsBox` for scoring tests and game-made tests.
- Clears `localStorage.stored_game` once results load.

## Development-only route

### Infra/Auth test page — `/test` (`src/pages/test.tsx`)

- Manual smoke tests for Postgres/Redis + auth flows.
- Not linked from any UI surface. Treat as internal tooling.
