---
sidebar_position: 4
title: Middleware
---

# Middleware — `src/proxy.ts`

Next.js middleware that redirects unauthenticated requests to `/login`. Currently applied to `/dashboard` via `config.matcher`.

:::warning
This is **not a security boundary**. It is an optimistic redirect to improve UX. Every protected page and API handler must perform its own session check. An attacker can bypass middleware-only guards.
:::

## Fields

| Name | Type | Description |
|---|---|---|
| `config.matcher` | `string[]` | Routes the middleware runs on. Currently `["/dashboard"]`. Add paths here to extend protection. |

## Functions

### `proxy(request: NextRequest): Promise<NextResponse>`

Called automatically by Next.js for every request matching `config.matcher`. Do not call directly.

| Parameter | Type | Description |
|---|---|---|
| `request` | `NextRequest` | Incoming request. Used as the base URL for the redirect. |

**Returns:**
- `NextResponse.redirect("/login")` if `auth.api.getSession` returns `null`.
- `NextResponse.next()` if a valid session exists.

**Preconditions:**
- `DATABASE_URL` must be set. `auth.api.getSession` hits the database.

**Throws:** Does not throw directly. If `auth.api.getSession` rejects (DB down, etc.), the error propagates to Next.js's middleware error handler.

**To protect additional routes:**
```typescript
export const config = {
  matcher: ["/dashboard", "/game/:path*"],
};
```
