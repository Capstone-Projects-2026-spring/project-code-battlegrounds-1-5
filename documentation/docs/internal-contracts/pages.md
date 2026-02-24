---
sidebar_position: 7
title: Pages
---

# Pages

---

## `LoginPage` — `src/pages/login.tsx`

`/login`. Submits credentials via `authClient.signIn.email`. Navigates to `/dashboard` on success, `alert`s the error message on failure.

### State

| Field | Type | Description |
|---|---|---|
| `email` | `string` | Email input value. Init: `""`. |
| `password` | `string` | Password input value. Init: `""`. |
| `loading` | `boolean` | Never set to `true` in the current implementation. Reserved for a loading indicator. |

### `handleLogin(): Promise<void>`

Calls `authClient.signIn.email` with current state.

**Preconditions:**
- `email` is a valid email format.
- `password` is non-empty.

**Postconditions (success):** `router.push("/dashboard")`. Session cookie set.

**Postconditions (failure):** `alert(ctx.error.message)`. No navigation.

**Throws:** None. Errors surface through `onError`.

### `data-testid` attributes

| `data-testid` | Element | Description |
|---|---|---|
| `email-login` | `<input type="email">` | Email field. |
| `password-login` | `<input type="password">` | Password field. |
| `login-button` | `<button type="submit">` | Submit. Disabled when `loading` is `true`. |

---

## `SignUpPage` — `src/pages/signup.tsx`

`/signup`. Registers a new account via `authClient.signUp.email`. Navigates to `/dashboard` on success, `alert`s on failure.

### State

| Field | Type | Description |
|---|---|---|
| `email` | `string` | Email input value. Init: `""`. |
| `password` | `string` | Password input value. Init: `""`. |
| `name` | `string` | Display name input value. Init: `""`. |
| `loading` | `boolean` | Never set to `true` in the current implementation. Reserved for a loading indicator. |

### `handleSignUp(): Promise<void>`

Calls `authClient.signUp.email` with current state.

**Preconditions:**
- `email` is a valid email format and not already registered.
- `password` is at least 8 characters (enforced server-side).
- `name` is non-empty.

**Postconditions (success):** `User` record created in DB. `router.push("/dashboard")`. Session cookie set.

**Postconditions (failure):** `alert(ctx.error.message)`. No record created. No navigation.

**Throws:** None. Errors surface through `onError`.

### `data-testid` attributes

| `data-testid` | Element | Description |
|---|---|---|
| `name-signup` | `<input type="text">` | Display name field. |
| `email-signup` | `<input type="email">` | Email field. |
| `password-signup` | `<input type="password">` | Password field. |
| `signup-button` | `<button type="submit">` | Submit. Disabled when `loading` is `true`. |

---

## `DashboardPage` — `src/pages/dashboard/index.tsx`

`/dashboard`. Protected page. Renders a welcome message and a sign-out button. Redirects to `/login` if unauthenticated.

### State

| Field | Type | Description |
|---|---|---|
| `session` | `Session \| null` | From `authClient.useSession()`. |
| `isPending` | `boolean` | `true` while the initial session fetch is in flight. |
| `error` | `Error \| null` | Non-null only if the session fetch itself failed (not just unauthenticated). |

### Auth guard

`useEffect` runs when `isPending` or `session` changes. Once `isPending` is `false`, if `session` is `null`, calls `router.push("/login")`. This is a **client-side** guard only. `proxy.ts` handles the server-side optimistic redirect for the same route. Both are required.

### Render states

| Condition | Output |
|---|---|
| `isPending === true` | `<p>Loading...</p>` |
| `isPending === false && session === null` | `null` (redirect in-flight) |
| `isPending === false && session !== null` | Welcome heading + Sign Out button |

### Sign Out button

Calls `authClient.signOut()`. Deletes session from DB and clears cookie. Handled internally by BetterAuth.

---

## `FindPartnerPage` — `src/pages/findPartnerPage.tsx`

Composition of `HeaderSimple`, `PartnerSearch`, and `StatsGroup` in a full-viewport flex column. No props. No API calls. No session checks.

### Layout

A `Stack` with `h="100vh"` and `gap={0}`:

| Region | Component | CSS behavior |
|---|---|---|
| Top | `HeaderSimple` | Natural height. |
| Middle | `PartnerSearch` in `Box` | `flex: 1` — fills remaining space. |
| Bottom | `StatsGroup` | Natural height. |

### Props passed to children

| Child | Props |
|---|---|
| `HeaderSimple` | `links={["Time", "Players", "Tournament"]}`, `title="Code BattleGrounds"` |
| `PartnerSearch` | (none) |
| `StatsGroup` | (none) |
