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
