# App Version Display — Design Spec

**Date:** 2026-05-15
**Status:** Approved

---

## Overview

Show the application version and build version in the AppBar as a compact chip. The chip is always visible, non-intrusive, and gives developers and support staff instant build traceability without navigating anywhere.

---

## Placement

The `AppVersionChip` component sits in the AppBar `Toolbar`, between the app name (`IDS Astra`) and the dark-mode toggle. It uses MUI's `Tooltip` to surface full details on hover; the chip itself is text-only, no click action needed.

---

## Chip Label

```
v0.0.1 · b6059f0 · 2026-05-15
```

Three fields separated by `·`:

| Field | Value | Source |
|---|---|---|
| App version | `v0.0.1` | `VITE_APP_VERSION` (root `package.json → version`) |
| Git SHA | `b6059f0` | `VITE_GIT_SHA` (short SHA at build time) |
| Build date | `2026-05-15` | `VITE_BUILD_DATE` (ISO date at build time) |

---

## Hover Tooltip

On hover, a MUI `Tooltip` (or custom Popper) expands to show:

```
IDS Astra
────────────────────
Version    0.0.1
Build      b6059f0
Date       2026-05-15
────────────────────
Env        development   ← blue badge in dev, plain text in prod
```

- In **development** (`import.meta.env.MODE === 'development'`): Env row shows a blue-tinted badge.
- In **production**: Env row shows plain muted text — no badge needed.

---

## Data Sourcing — Build-Time Injection via Vite `define`

All three values are injected at build time by extending `vite.config.ts`. No runtime API call is needed.

### Values injected

```ts
// vite.config.ts
import {execSync} from 'node:child_process';
import pkg from '../../package.json'; // root package.json

const gitSha = execSync('git rev-parse --short HEAD').toString().trim();
const buildDate = new Date().toISOString().slice(0, 10);

define: {
  'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha),
  'import.meta.env.VITE_BUILD_DATE': JSON.stringify(buildDate),
}
```

The environment is already available via `import.meta.env.MODE` — no extra injection needed.

### TypeScript typing

Add the three new env vars to the existing Vite env type declaration so TypeScript knows about them:

```ts
// apps/client-web/app/vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_GIT_SHA: string;
  readonly VITE_BUILD_DATE: string;
}
```

---

## Component

**File:** `apps/client-web/app/components/AppVersionChip.tsx`

```
AppVersionChip
  └─ MUI Tooltip (title = rich tooltip content)
       └─ Box (chip container — styled span/div, no Button)
            └─ Typography (chip label text)
```

The chip is **not interactive** (no `onClick`). It is `aria-label`-ed for accessibility. The tooltip uses `placement="bottom-end"` to avoid overlapping the icons to its right.

### Chip visual style

- Background: `rgba(255,255,255,0.1)` (works on the blue AppBar in both light and dark mode)
- Border: `1px solid rgba(255,255,255,0.2)`
- Border-radius: `12px` (pill shape)
- Font: `monospace`, `0.68rem`
- Color: `rgba(255,255,255,0.75)`
- No hover state change (read-only indicator)

---

## Integration in Layout

In `apps/client-web/app/components/Layout.tsx`, insert `<AppVersionChip />` in the `<Toolbar>` between the app name `<Typography>` and the dark-mode `<IconButton>`:

```tsx
<Typography ...>{t('common:appName')}</Typography>

<AppVersionChip />   {/* ← insert here */}

<Tooltip title={mode === 'dark' ? ...}>
  <IconButton onClick={toggleColorMode}>...
```

---

## Out of Scope

- Backend version endpoint — not needed; frontend is self-contained.
- Clickable chip opening an About dialog — overkill for this use case.
- Sidebar footer version display — rejected in favour of AppBar placement.
- Sequential build counter (`#42`) — git SHA is more traceable and requires no counter infrastructure.
