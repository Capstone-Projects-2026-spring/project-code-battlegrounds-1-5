---
sidebar_position: 2
title: Authentication Module
---

# Authentication Module

## `auth` — `src/lib/auth.ts`

Server-side BetterAuth singleton. Configured with the Prisma/PostgreSQL adapter and email+password auth enabled. Using Google OAuth in the future. Requires `DATABASE_URL` to be set before the module is imported.

### Fields

| Name | Type | Visibility | Description |
|---|---|---|---|
| `auth` | `BetterAuth` | public | Server-side auth instance. Used by API routes and middleware to validate sessions. |

### Methods

#### `auth.api.getSession(options): Promise<Session | null>`

Looks up the session from the request headers. Returns `null` if no valid session cookie is present or the session is expired.

| Parameter | Type | Description |
|---|---|---|
| `options.headers` | `Headers` | Request headers. Must contain the session cookie. |

**Returns:** `Session` (with `.user` and `.session` fields) or `null`.

**Preconditions:**
- `DATABASE_URL` must point to a reachable PostgreSQL instance.

**Throws:** Does not throw directly. If the database is unreachable, the underlying rejection propagates. Callers should wrap in `try/catch`.

```typescript
const session = await auth.api.getSession({
  headers: await headers(),
});
if (!session) return NextResponse.redirect(new URL("/login", req.url));
```

---

#### `auth.handler`

HTTP handler for all `/api/auth/[...all]` routes (sign-in, sign-out, session refresh, etc.). Wrapped with `toNodeHandler` for Next.js Pages Router compatibility.

**Preconditions:**
- The API route must set `export const config = { api: { bodyParser: false } }`. BetterAuth parses the body itself.

**Postconditions:**
- Sign-in: creates a `Session` record in the database and sets a session cookie.
- Sign-out: deletes the `Session` record and clears the cookie.

---

## `authClient` — `src/lib/auth-client.ts`

Browser-side BetterAuth client. Auth API base URL is read from `BETTER_AUTH_URL`. All methods are non-throwing — errors come back through the return value or the `onError` callback.

### Fields

| Name | Type | Visibility | Description |
|---|---|---|---|
| `authClient` | `AuthClient` | public | Client-side singleton. Use this in React components and pages. |

### Methods

#### `authClient.signIn.email(credentials, callbacks): Promise<{ data: Session | null, error: AuthError | null }>`

Submits an email/password sign-in request.

| Parameter | Type | Description |
|---|---|---|
| `credentials.email` | `string` | User's email. |
| `credentials.password` | `string` | User's password. |
| `credentials.callbackURL` | `string?` | Redirect target after sign-in. |
| `callbacks.onRequest` | `(ctx) => void?` | Fired when the request is dispatched. |
| `callbacks.onSuccess` | `(ctx) => void?` | Fired on successful sign-in. |
| `callbacks.onError` | `(ctx) => void?` | Fired on failure. `ctx.error.message` has the reason. |

**Preconditions:**
- `email` must be a valid email format.
- `password` must be non-empty.

**Postconditions (success):** Session cookie is set in the browser. `data` contains the session.

**Postconditions (failure):** `error` is populated. No cookie is set.

```typescript
const { data, error } = await authClient.signIn.email(
  { email: "user@example.com", password: "P@ssw0rd", callbackURL: "/dashboard" },
  { onError: (ctx) => alert(ctx.error.message) },
);
```

---

#### `authClient.signUp.email(credentials, callbacks): Promise<{ data: Session | null, error: AuthError | null }>`

Registers a new account.

| Parameter | Type | Description |
|---|---|---|
| `credentials.email` | `string` | Must be unique. |
| `credentials.password` | `string` | Min 8 characters (enforced server-side). |
| `credentials.name` | `string` | Display name. |
| `credentials.callbackURL` | `string?` | Post-verification redirect. |
| `callbacks.onSuccess` | `(ctx) => void?` | Fired on successful registration. |
| `callbacks.onError` | `(ctx) => void?` | Fired on failure (duplicate email, weak password, etc.). |

**Preconditions:**
- `email` is not already registered.
- `password` is at least 8 characters.
- `name` is non-empty.

**Postconditions (success):** `User` record created in DB. Session cookie set.

**Postconditions (failure):** No `User` record created. `error` is populated.

```typescript
await authClient.signUp.email(
  { email: "new@example.com", password: "SecurePass1", name: "Alice" },
  { onError: (ctx) => alert(ctx.error.message) },
);
```

---

#### `authClient.signOut(): Promise<void>`

Deletes the current session from the database and clears the session cookie. No-op if the user is not signed in.

---

#### `authClient.useSession(): { data: Session | null, isPending: boolean, error: Error | null, refetch: () => void }`

React hook. Fetches the current session on mount and re-renders the component when session state changes.

- `isPending` — `true` during the initial fetch.
- `data` — session object, or `null` if unauthenticated.
- `error` — non-null only if the fetch itself failed (network error, etc.).
