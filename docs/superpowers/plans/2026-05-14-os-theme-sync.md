# OS Theme Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree note:** Before implementing, create an isolated git worktree via the `superpowers:using-git-worktrees` skill.

**Goal:** Add a "System" theme option that reads the OS `prefers-color-scheme` preference and reacts to it live, selectable from a 3-item AppBar dropdown menu.

**Architecture:** Extend `ColorModeContext` to a 3-state model (`ThemePreference = 'light' | 'dark' | 'system'`) while keeping the resolved `PaletteMode` as the value passed to MUI. A `matchMedia` event listener drives live OS sync when preference is `'system'`. The AppBar toggle becomes a MUI `Menu` with three items.

**Tech Stack:** React 19, MUI v7, TypeScript, `window.matchMedia` Web API, `localStorage`

---

## File Map

| File | Change |
|---|---|
| `apps/client-web/app/contexts/ColorModeContext.tsx` | Full rewrite — 3-state preference, resolvedMode, matchMedia listener |
| `apps/client-web/app/root.tsx` | `mode` → `resolvedMode` in `ThemedApp` (2-line change) |
| `apps/client-web/app/components/Layout.tsx` | Replace AppBar toggle with 3-item theme menu |

No new files. No backend changes.

> **Note on testing:** `apps/client-web` has no configured test runner. TypeScript compilation (`npx tsc --noEmit`) is used as the verification gate after each task. Manual browser testing covers behaviour.

---

## Task 1: Rewrite ColorModeContext with 3-state model

**Files:**
- Modify: `apps/client-web/app/contexts/ColorModeContext.tsx`

### What this task does

Replaces the 2-state toggle (`'light' | 'dark'`) with a 3-state preference model. The context stores what the user chose (`ThemePreference`) and separately tracks the resolved MUI value (`resolvedMode`). A `matchMedia` listener fires when the OS changes and updates `resolvedMode` live — but only while preference is `'system'`. The listener is cleaned up whenever preference changes away from `'system'` or on unmount.

- [ ] **Step 1: Replace the entire file with the new implementation**

  ```tsx
  import type {PaletteMode} from '@mui/material';
  import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

  export type ThemePreference = 'light' | 'dark' | 'system';

  type ColorModeContextType = {
    preference: ThemePreference;
    resolvedMode: PaletteMode;
    setPreference: (p: ThemePreference) => void;
  };

  export const ColorModeContext = createContext<ColorModeContextType>({
    preference: 'light',
    resolvedMode: 'light',
    setPreference: () => {},
  });

  export function useColorMode() {
    return useContext(ColorModeContext);
  }

  const STORAGE_KEY = 'ids_color_mode';
  const VALID_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];

  function getSystemMode(): PaletteMode {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getInitialPreference(): ThemePreference {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    return stored && VALID_PREFERENCES.includes(stored) ? stored : 'light';
  }

  function resolveMode(preference: ThemePreference): PaletteMode {
    if (preference === 'system') return getSystemMode();
    return preference;
  }

  export function ColorModeProvider({children}: {children: React.ReactNode}) {
    const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference);
    const [resolvedMode, setResolvedMode] = useState<PaletteMode>(() => resolveMode(getInitialPreference()));

    useEffect(() => {
      if (preference !== 'system') {
        setResolvedMode(preference);
        return;
      }

      setResolvedMode(getSystemMode());

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        setResolvedMode(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }, [preference]);

    const setPreference = useCallback((p: ThemePreference) => {
      localStorage.setItem(STORAGE_KEY, p);
      setPreferenceState(p);
    }, []);

    const value = useMemo(
      () => ({preference, resolvedMode, setPreference}),
      [preference, resolvedMode, setPreference],
    );

    return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles clean**

  Run from the repo root:
  ```bash
  npx tsc -p apps/client-web/tsconfig.json --noEmit 2>&1 | head -40
  ```

  Expected: errors only about the two call sites that still use the old `mode` / `toggleColorMode` destructure (`root.tsx` and `Layout.tsx`). No errors inside `ColorModeContext.tsx` itself.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/client-web/app/contexts/ColorModeContext.tsx
  git commit -m "feat: extend ColorModeContext to 3-state theme preference with OS sync"
  ```

---

## Task 2: Update root.tsx — use resolvedMode in ThemedApp

**Files:**
- Modify: `apps/client-web/app/root.tsx:68-75`

### What this task does

`ThemedApp` currently reads `mode` from the context and passes it to `createAppTheme()`. After Task 1, `mode` no longer exists — replace it with `resolvedMode`. Same for the `colorScheme` effect.

- [ ] **Step 1: Update the destructure and usages in ThemedApp**

  In `apps/client-web/app/root.tsx`, replace the `ThemedApp` function (lines 67–83):

  ```tsx
  function ThemedApp({children}: {children: React.ReactNode}) {
    const {resolvedMode} = useColorMode();
    const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode]);

    useEffect(() => {
      document.documentElement.style.colorScheme = resolvedMode;
    }, [resolvedMode]);

    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    );
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles — only Layout.tsx errors remain**

  ```bash
  npx tsc -p apps/client-web/tsconfig.json --noEmit 2>&1 | head -40
  ```

  Expected: `root.tsx` is now clean. Remaining errors point to `Layout.tsx` call site only.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/client-web/app/root.tsx
  git commit -m "fix: update ThemedApp to consume resolvedMode from ColorModeContext"
  ```

---

## Task 3: Replace AppBar toggle with 3-item theme menu in Layout.tsx

**Files:**
- Modify: `apps/client-web/app/components/Layout.tsx`

### What this task does

The current `IconButton + Tooltip` toggle at line ~751 is replaced by an `IconButton` that opens a MUI `Menu` popover. Three `MenuItem`s — Light, Dark, System — call `setPreference`. The selected item shows a `CheckIcon` on the right. The button icon reflects current state: `SettingsBrightnessIcon` when preference is `'system'`, otherwise the resolved mode icon.

- [ ] **Step 1: Add required icon imports**

  In `apps/client-web/app/components/Layout.tsx`, add two new icon imports near the existing icon imports (alphabetical order is the established pattern):

  After line 19 (`import ChecklistIcon ...`):
  ```tsx
  import CheckIcon from '@mui/icons-material/Check';
  ```

  After line 52 (`import SyncIcon ...`):
  ```tsx
  import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
  ```

- [ ] **Step 2: Update the useColorMode destructure at line 156**

  Replace:
  ```tsx
  const {mode, toggleColorMode} = useColorMode();
  ```

  With:
  ```tsx
  const {preference, resolvedMode, setPreference} = useColorMode();
  ```

- [ ] **Step 3: Add theme menu anchor state**

  Find the existing `useState` declarations near the top of the `Layout` function body (around line 138–155). Add this line alongside the other `useState` declarations:

  ```tsx
  const [themeAnchorEl, setThemeAnchorEl] = useState<HTMLElement | null>(null);
  ```

- [ ] **Step 4: Replace the AppBar toggle button with the theme menu**

  Find and replace the existing toggle block (~lines 751–760):

  **Remove:**
  ```tsx
  <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
    <IconButton
      aria-label="toggle dark mode"
      color="inherit"
      onClick={toggleColorMode}
      sx={{ml: 1}}
    >
      {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
  </Tooltip>
  ```

  **Replace with:**
  ```tsx
  <Tooltip title="Theme">
    <IconButton
      aria-label="theme"
      color="inherit"
      onClick={(e) => setThemeAnchorEl(e.currentTarget)}
      sx={{ml: 1}}
    >
      {preference === 'system' ? (
        <SettingsBrightnessIcon />
      ) : resolvedMode === 'dark' ? (
        <DarkModeIcon />
      ) : (
        <LightModeIcon />
      )}
    </IconButton>
  </Tooltip>
  <Menu
    anchorEl={themeAnchorEl}
    open={Boolean(themeAnchorEl)}
    onClose={() => setThemeAnchorEl(null)}
    anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
    transformOrigin={{vertical: 'top', horizontal: 'right'}}
  >
    <MenuItem
      selected={preference === 'light'}
      onClick={() => {
        setPreference('light');
        setThemeAnchorEl(null);
      }}
    >
      <ListItemIcon>
        <LightModeIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText>Light</ListItemText>
      {preference === 'light' && <CheckIcon fontSize="small" sx={{ml: 1}} />}
    </MenuItem>
    <MenuItem
      selected={preference === 'dark'}
      onClick={() => {
        setPreference('dark');
        setThemeAnchorEl(null);
      }}
    >
      <ListItemIcon>
        <DarkModeIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText>Dark</ListItemText>
      {preference === 'dark' && <CheckIcon fontSize="small" sx={{ml: 1}} />}
    </MenuItem>
    <MenuItem
      selected={preference === 'system'}
      onClick={() => {
        setPreference('system');
        setThemeAnchorEl(null);
      }}
    >
      <ListItemIcon>
        <SettingsBrightnessIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText>System</ListItemText>
      {preference === 'system' && <CheckIcon fontSize="small" sx={{ml: 1}} />}
    </MenuItem>
  </Menu>
  ```

- [ ] **Step 5: Verify TypeScript compiles with zero errors**

  ```bash
  npx tsc -p apps/client-web/tsconfig.json --noEmit 2>&1 | head -40
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/client-web/app/components/Layout.tsx
  git commit -m "feat: replace AppBar theme toggle with Light/Dark/System menu"
  ```

---

## Task 4: Manual Browser Verification

**Files:** none — verification only

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev
  ```

  Open the app in a browser (default: `http://localhost:5173`).

- [ ] **Step 2: Verify Light / Dark switching still works**

  - Click the theme icon in the AppBar → menu opens with Light, Dark, System items.
  - Click **Light** → app switches to light mode, checkmark appears next to Light, icon changes to sun.
  - Click **Dark** → app switches to dark mode, checkmark appears next to Dark, icon changes to moon.
  - Reload the page → preference is remembered (localStorage persists).

- [ ] **Step 3: Verify System mode — static**

  - Click **System** → app adopts your OS theme, checkmark appears next to System, icon changes to `SettingsBrightness`.
  - Reload → System preference is remembered.

- [ ] **Step 4: Verify System mode — live OS change**

  Simulate an OS theme change via browser DevTools:

  In Chrome/Edge DevTools → `Rendering` tab → `Emulate CSS media feature prefers-color-scheme` → toggle between `light` and `dark`.

  Expected: while System is selected, the app theme switches immediately with no reload.

- [ ] **Step 5: Verify manual preference overrides system**

  While on System mode, switch to Dark. Then change the DevTools emulation to `light`. Expected: app stays dark (manual preference wins over OS).

- [ ] **Step 6: Verify existing localStorage values are migrated gracefully**

  Open DevTools → Application → Local Storage → set `ids_color_mode` to an invalid value (e.g. `"banana"`). Reload. Expected: app defaults to light mode without crashing.
