---
sidebar_position: 1
title: Overview
---

# Internal Code Contracts

Contracts must stay in sync with the implementation. If a method signature, exception condition, or behavior changes, update the contract in the same PR.

## Modules

| Module | File | Contract |
|---|---|---|
| `auth` | `src/lib/auth.ts` | [auth / authClient](./auth) |
| `authClient` | `src/lib/auth-client.ts` | [auth / authClient](./auth) |
| `prisma` | `src/lib/prisma.ts` | [Prisma Client](./prisma) |
| `proxy` | `src/proxy.ts` | [Middleware](./proxy) |
| `Question` / `handler` | `src/pages/api/question.ts` | [Question API](./question-api) |
| `HeaderSimple` | `src/components/Navbar.tsx` | [UI Components](./components) |
| `StatsGroup` | `src/components/Broadstats.tsx` | [UI Components](./components) |
| `Subgrid` | `src/components/DifficultyGrid.tsx` | [UI Components](./components) |
| `PartnerSearch` | `src/components/PartnerSearch.tsx` | [UI Components](./components) |
| `LoginPage` | `src/pages/login.tsx` | [Pages](./pages) |
| `SignUpPage` | `src/pages/signup.tsx` | [Pages](./pages) |
| `DashboardPage` | `src/pages/dashboard/index.tsx` | [Pages](./pages) |
| `FindPartnerPage` | `src/pages/findPartnerPage.tsx` | [Pages](./pages) |

## Error-handling conventions

- API handlers never throw. They return `{ error: string }` with an appropriate status code.
- Unexpected errors are logged with `console.error` before sending a `500`.
- Unauthenticated access to protected endpoints returns `401`.
- Wrong HTTP method returns `405`.
- Errors from `authClient` are surfaced through the `onError` callback or the returned `error` field, not thrown.
