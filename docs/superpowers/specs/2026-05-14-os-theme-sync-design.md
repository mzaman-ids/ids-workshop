# OS Theme Sync — Design Spec

**Date:** 2026-05-14  
**Status:** Approved  
**Scope:** Frontend only — no backend or DB changes

---

## Overview

The app currently supports light and dark modes toggled manually via an AppBar button, persisted to `localStorage`. This feature adds a third option — **System** — that reads the OS `prefers-color-scheme` preference and reacts to it live. The user opts in explicitly; a manual pick (Light or Dark) always overrides system sync.

---

## Data Model

### New Type

```ts
type ThemePreference = 'light' | 'dark' | 'system';
```

### Stored Value

- **Key:** `ids_color_mode` (unchanged)
- **Values:** `'light'` | `'dark'` | `'system'` (was: `'light'` | `'dark'`)
- **Validation on read:** if stored value is not one of the three valid strings, default to `'light'`

### Derived Value

`resolvedMode: PaletteMode` (`'light' | 'dark'`) is what MUI receives:

| Preference | resolvedMode |
|---|---|
| `'light'` | `'light'` |
| `'dark'` | `'dark'` |
| `'system'` | OS `prefers-color-scheme` result (live) |

### SSR Fallback

`typeof window === 'undefined'` → preference = `'light'`, resolvedMode = `'light'` (unchanged from today).

---

## Context Changes

**File:** `apps/client-web/app/contexts/ColorModeContext.tsx`

### Updated Interface

```ts
interface ColorModeContextValue {
  preference: ThemePreference;
  resolvedMode: PaletteMode;
  setPreference: (p: ThemePreference) => void;
}
```

### Provider Behaviour

1. On mount: read `localStorage.getItem('ids_color_mode')`, validate, fall back to `'light'`.
2. `useState<ThemePreference>` for preference.
3. `useState<PaletteMode>` for resolvedMode — initialised synchronously from the derivation function.
4. `useEffect` runs on every `preference` change:
   - `'light'` / `'dark'`: set resolvedMode directly, remove any existing `matchMedia` listener.
   - `'system'`: derive resolvedMode from `window.matchMedia('(prefers-color-scheme: dark)').matches`; attach `change` event listener that updates resolvedMode live; return cleanup that removes the listener.
5. `setPreference`: writes to `localStorage`, calls the state setter.

### Hook Export

```ts
export const useColorMode = (): ColorModeContextValue
```

---

## UI Changes

**File:** `apps/client-web/app/components/Layout.tsx`

### AppBar Theme Control (~line 751)

Replace the current `IconButton + Tooltip` toggle with an `IconButton` that opens a MUI `Menu` popover.

**Icon displayed on the button:**

| Condition | Icon |
|---|---|
| `preference === 'system'` | `SettingsBrightnessIcon` |
| `resolvedMode === 'dark'` | `DarkModeIcon` |
| `resolvedMode === 'light'` | `LightModeIcon` |

**Tooltip:** `'Theme'` (static, replaces current mode-specific tooltip text).

**Menu items:**

| Label | Icon | Selected when |
|---|---|---|
| Light | `LightModeIcon` | `preference === 'light'` |
| Dark | `DarkModeIcon` | `preference === 'dark'` |
| System | `SettingsBrightnessIcon` | `preference === 'system'` |

Selected item uses MUI `MenuItem` `selected` prop and a `CheckIcon` on the right.

**Local state in Layout:** `anchorEl: HTMLElement | null` for Menu open/close — standard MUI Menu pattern.

### Call-Site Updates

Two places currently read `mode` from `useColorMode()`:
1. `root.tsx` — `ThemedApp`: switch `mode` → `resolvedMode` when passing to `createAppTheme()`
2. `Layout.tsx` — AppBar toggle: replaced by new menu (no direct `mode` read needed)

---

## Files Touched

| File | Change |
|---|---|
| `apps/client-web/app/contexts/ColorModeContext.tsx` | Full rewrite — 3-state model, matchMedia listener |
| `apps/client-web/app/components/Layout.tsx` | Replace toggle button with theme menu |
| `apps/client-web/app/root.tsx` | `mode` → `resolvedMode` at `createAppTheme()` call |

No new files. No backend changes. No DB changes. No i18n keys (labels are English, consistent with existing toggle).

---

## Edge Cases

- **No `matchMedia` support** (very old browsers): `window.matchMedia` call is guarded — falls back to `'light'` if undefined.
- **OS changes while app is open:** `matchMedia` `change` event fires → resolvedMode updates → React re-renders → MUI theme switches live.
- **User switches away from System:** listener is removed in `useEffect` cleanup before new preference takes effect.
- **SSR:** `typeof window === 'undefined'` guard unchanged — server renders with light theme.
