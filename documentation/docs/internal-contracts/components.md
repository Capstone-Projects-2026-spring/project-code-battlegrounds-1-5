---
sidebar_position: 6
title: UI Components
---

# UI Components

---

## `HeaderSimple` — `src/components/Navbar.tsx`

Top navigation bar. Title on left, links on right, hamburger below the `xs` breakpoint.

### Props (`HeaderProps`)

| Prop | Type | Description |
|---|---|---|
| `links` | `string[]` | Nav link labels. `links[0]` is the initial active link. **Must not be empty** — `links[0]` is accessed unconditionally. |
| `title` | `string` | Displayed on the left side of the header. |

### State

| Field | Type | Description |
|---|---|---|
| `opened` | `boolean` | Whether the mobile hamburger menu is open. |
| `active` | `string` | Currently highlighted link label. Init: `links[0]`. |

### Behavior

- Clicking a link calls `event.preventDefault()` and updates `active`. **Navigation is not implemented** — this is a visual-only state change.
- Hamburger is visible only below the `xs` breakpoint.

### Example

```tsx
<HeaderSimple
  links={["Home", "Play", "Leaderboard"]}
  title="Code BattleGrounds"
/>
```

---

## `StatsGroup` — `src/components/Broadstats.tsx`

Displays three stat tiles. No props. Data is **hard-coded** in the module-level `data` constant — no API calls are made. Replace `data` with a fetch when real metrics are available.

### `data` shape

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Stat label. |
| `stats` | `string` | Formatted value string. |
| `description` | `string` | Context sentence. |

### Example

```tsx
<StatsGroup />
```

---

## `Subgrid` — `src/components/DifficultyGrid.tsx`

Three-column difficulty selection grid (Easy / Medium / Hard). No props.

### State

| Field | Type | Description |
|---|---|---|
| `loading` | `boolean` | When `true`, renders `Skeleton` placeholders instead of cards. Default: `false`. Nothing currently sets this to `true` — it is wired up for future async use. |

### Card layout

| Difficulty | Dot color | Topics |
|---|---|---|
| Easy | `green.6` | Arrays, Strings |
| Medium | `orange.6` | Math, Hash Maps, Sorts |
| Hard | `red.6` | DSA, Trees, Graphs, Dynamic Programming |

### Behavior

- Vote buttons have no `onClick` handler. Clicks do nothing.

### Example

```tsx
<Subgrid />
```

---

## `PartnerSearch` — `src/components/PartnerSearch.tsx`

Partner selection UI with a search input and a random-assignment button. No props. Both action handlers are **stubs** — they only log to `console.log`.

### State

| Field | Type | Description |
|---|---|---|
| `query` | `string` | Current value of the username input. Init: `""`. |

### Handlers

#### `handleRandom(): void`

`console.log("Pick a random partner")`. No logic implemented.

#### `handleSearch(): void`

`console.log("Search partner:", query)`. No logic implemented.

### Example

```tsx
<PartnerSearch />
```
