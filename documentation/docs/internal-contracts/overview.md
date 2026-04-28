---
sidebar_position: 1
title: Overview
---

# Internal Code Contracts

Contracts must stay in sync with implementation. If route behavior, context state, emitted/listened socket events, or component props change, update these docs in the same PR.

## Frontend + context modules

| Module | File | Contract |
|---|---|---|
| App shell and provider composition | `src/pages/_app.tsx` | [Pages](./pages), [Frontend Context Providers](./contexts) |
| Home + onboarding pages | `src/pages/index.tsx`, `src/pages/tutorial.tsx` | [Pages](./pages) |
| Auth pages | `src/pages/login.tsx`, `src/pages/signup.tsx` | [Pages](./pages) |
| Matchmaking flow | `src/pages/matchmaking.tsx`, `src/components/home/FindLobbySection.tsx`, `src/components/home/DifficultySection.tsx` | [Pages](./pages), [UI Components](./components) |
| Game room flow | `src/pages/game/[gameID].tsx` | [Pages](./pages) |
| Results flow | `src/pages/results/[gameID].tsx`, `src/hooks/useGameResults.ts` | [Pages](./pages) |
| Socket lifecycle | `src/contexts/SocketContext.tsx` | [Frontend Context Providers](./contexts) |
| Party + friend lifecycle | `src/contexts/PartyContext.tsx`, `src/contexts/FriendshipContext.tsx` | [Frontend Context Providers](./contexts) |
| Matchmaking shared state | `src/contexts/MatchmakingContext.tsx` | [Frontend Context Providers](./contexts) |
| Game-local shared state | `src/contexts/GameStateContext.tsx`, `src/contexts/GameTestCasesContext.tsx` | [Frontend Context Providers](./contexts) |
| Navbar + side panel | `src/components/Navbar.tsx`, `src/components/sidebar/*` | [UI Components](./components) |
| Game-room components | `src/components/ProblemBox.tsx`, `src/components/ChatBox.tsx`, `src/components/GameTimer.tsx`, `src/components/gameTests/*` | [UI Components](./components) |
| Results components | `src/components/Analysisbox.tsx`, `src/components/TestCaseResultsBox.tsx` | [UI Components](./components) |

## Shared backend modules

| Module | File | Contract |
|---|---|---|
| `auth` | `src/lib/auth.ts` | [auth / authClient](./auth) |
| `authClient` | `src/lib/auth-client.ts` | [auth / authClient](./auth) |
| `prisma` | `src/lib/prisma.ts` | [Prisma Client](./prisma) |
| `proxy` | `src/proxy.ts` | [Middleware](./proxy) |
| Question API route | `src/pages/api/question.ts` | [Question API](./question-api) |
| Socket.IO event surface | `server/index.js`, `server/socketEvents/*.js` | [WebSocket](./websocket) |

## Error-handling conventions

- API handlers should return typed error payloads with status codes (`4xx`/`5xx`) instead of crashing the process.
- UI-level errors are surfaced through notification helpers (e.g., `showErrorNotification`) or local page-state messaging.
- Unauthenticated access is guarded both by middleware/proxy rules and by page-level session checks.
