# App Version Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a version chip in the AppBar (`v0.0.1 · b6059f0 · 2026-05-15`) with a rich hover tooltip revealing full build details and environment.

**Architecture:** Build-time injection via Vite `define` bakes app version (from root `package.json`), git SHA (`git rev-parse --short HEAD`), and build date into the bundle. A `buildInfo.ts` module exposes these as constants. A new `AppVersionChip` component reads from that module and renders a pill-shaped chip in the AppBar Toolbar.

**Tech Stack:** React 19, MUI v7, Vite, Vitest + Testing Library

---

## Files

| Action | Path | Responsibility |
|---|---|---|
| Modify | `apps/client-web/vite.config.ts` | Add `define` block to inject build-time values |
| Modify | `apps/client-web/app/vite-env.d.ts` | Declare 3 new `ImportMetaEnv` properties |
| Create | `apps/client-web/app/core/config/buildInfo.ts` | Export `BUILD_INFO` constants (version, sha, date, env) |
| Create | `apps/client-web/app/components/AppVersionChip.tsx` | Chip + tooltip component |
| Modify | `apps/client-web/app/components/Layout.tsx` | Insert `<AppVersionChip />` in AppBar Toolbar |
| Create | `apps/client-web/tests/components/AppVersionChip.test.tsx` | Unit tests for the chip component |

---

## Task 1: Inject build-time values and declare types

**Files:**
- Modify: `apps/client-web/vite.config.ts`
- Modify: `apps/client-web/app/vite-env.d.ts`
- Create: `apps/client-web/app/core/config/buildInfo.ts`

- [ ] **Step 1: Add imports and define block to `vite.config.ts`**

Replace the top of `apps/client-web/vite.config.ts` and convert the arrow-function shorthand to a block body so we can compute values before returning:

```ts
/// <reference types='vitest' />
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import type {IncomingMessage, ServerResponse} from 'node:http';
import path from 'node:path';
import {reactRouter} from '@react-router/dev/vite';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const pkg = JSON.parse(
    readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'),
  ) as {version: string};

  let gitSha = 'unknown';
  try {
    gitSha = execSync('git rev-parse --short HEAD', {cwd: __dirname}).toString().trim();
  } catch {
    // not in a git repo or git unavailable — keep 'unknown'
  }

  const buildDate = new Date().toISOString().slice(0, 10);

  return {
    root: __dirname,
    cacheDir: '../../node_modules/.vite/apps/client-web',
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
      'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha),
      'import.meta.env.VITE_BUILD_DATE': JSON.stringify(buildDate),
    },
    server: {
      port: 3004,
      host: 'localhost',
      strictPort: true,
      watch: {
        ignored: ['**/node_modules/**'],
      },
      warmup: {
        clientFiles: ['./app/pages/**/*.tsx', './app/components/**/*.tsx'],
      },
    },
    preview: {
      port: 4300,
      host: 'localhost',
    },
    plugins: [
      !process.env.VITEST && reactRouter(),
      {
        name: 'suppress-devtools-errors',
        configureServer(server: {
          middlewares: {
            use: (
              arg0: (
                req: import('http').IncomingMessage,
                res: import('http').ServerResponse,
                next: () => void,
              ) => void,
            ) => void;
          };
        }) {
          server.middlewares.use(
            (req: IncomingMessage, res: ServerResponse<IncomingMessage>, next: () => void) => {
              if (req.url?.includes('.well-known/appspecific/com.chrome.devtools.json')) {
                res.statusCode = 204;
                res.end();
                return;
              }
              next();
            },
          );
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        components: path.resolve(__dirname, 'app/components'),
        core: path.resolve(__dirname, 'app/core'),
        i18n: path.resolve(__dirname, 'app/i18n.ts'),
        middleware: path.resolve(__dirname, 'app/middleware'),
        pages: path.resolve(__dirname, 'app/pages'),
        types: path.resolve(__dirname, 'app/types'),
        'class-validator': path.resolve(__dirname, 'app/stubs/class-validator.stub.ts'),
        'class-transformer': path.resolve(__dirname, 'app/stubs/class-transformer.stub.ts'),
        '@nestjs/swagger': path.resolve(__dirname, 'app/stubs/nestjs-swagger.stub.ts'),
        'reflect-metadata': path.resolve(__dirname, 'app/stubs/reflect-metadata.stub.ts'),
      },
    },
    optimizeDeps: {
      exclude: ['@nestjs/mapped-types'],
      include: [
        '@emotion/react',
        '@emotion/styled',
        '@mui/material',
        '@mui/system',
        '@mui/icons-material',
      ],
    },
    build: {
      outDir: './dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    test: {
      name: '@ids-ai-skeleton/client-web',
      watch: false,
      passWithNoTests: true,
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: './test-output/vitest/coverage',
        provider: 'v8' as const,
      },
    },
  };
});
```

- [ ] **Step 2: Add type declarations to `apps/client-web/app/vite-env.d.ts`**

Replace the file contents:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_LOGTO_ENDPOINT: string;
  readonly VITE_LOGTO_APP_ID: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_GIT_SHA: string;
  readonly VITE_BUILD_DATE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 3: Create `apps/client-web/app/core/config/buildInfo.ts`**

```ts
export const BUILD_INFO = {
  version: import.meta.env.VITE_APP_VERSION ?? 'dev',
  gitSha: import.meta.env.VITE_GIT_SHA ?? 'local',
  buildDate: import.meta.env.VITE_BUILD_DATE ?? 'unknown',
  env: import.meta.env.MODE,
} as const;
```

- [ ] **Step 4: Run typecheck to verify no TypeScript errors**

```bash
npm run typecheck:web
```

Expected: exits with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client-web/vite.config.ts apps/client-web/app/vite-env.d.ts apps/client-web/app/core/config/buildInfo.ts
git commit -m "feat: inject build-time version, git SHA and build date via vite define"
```

---

## Task 2: Create AppVersionChip component with tests

**Files:**
- Create: `apps/client-web/tests/components/AppVersionChip.test.tsx`
- Create: `apps/client-web/app/components/AppVersionChip.tsx`

- [ ] **Step 1: Create the test file**

Create `apps/client-web/tests/components/AppVersionChip.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {AppVersionChip} from '../../app/components/AppVersionChip';

vi.mock('core/config/buildInfo', () => ({
  BUILD_INFO: {
    version: '1.2.3',
    gitSha: 'abc1234',
    buildDate: '2026-05-15',
    env: 'test',
  },
}));

describe('AppVersionChip', () => {
  it('renders version, git SHA and build date in the chip label', () => {
    render(<AppVersionChip />);
    expect(screen.getByText('v1.2.3 · abc1234 · 2026-05-15')).toBeInTheDocument();
  });

  it('has an accessible aria-label containing the version string', () => {
    render(<AppVersionChip />);
    expect(
      screen.getByLabelText('App version: v1.2.3 · abc1234 · 2026-05-15'),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --reporter=verbose --testPathPattern=AppVersionChip
```

Expected: FAIL — `Cannot find module '../../app/components/AppVersionChip'`

- [ ] **Step 3: Create `apps/client-web/app/components/AppVersionChip.tsx`**

```tsx
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {BUILD_INFO} from 'core/config/buildInfo';

function VersionTooltip() {
  const isDev = BUILD_INFO.env === 'development';
  return (
    <Box sx={{minWidth: 160}}>
      <Typography variant="caption" sx={{fontWeight: 700, display: 'block', mb: 0.75}}>
        IDS Astra
      </Typography>
      <Box
        sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.25}}
      >
        <Typography variant="caption" sx={{color: 'primary.light'}}>
          Version
        </Typography>
        <Typography variant="caption">{BUILD_INFO.version}</Typography>

        <Typography variant="caption" sx={{color: 'primary.light'}}>
          Build
        </Typography>
        <Typography variant="caption" sx={{fontFamily: 'monospace'}}>
          {BUILD_INFO.gitSha}
        </Typography>

        <Typography variant="caption" sx={{color: 'primary.light'}}>
          Date
        </Typography>
        <Typography variant="caption">{BUILD_INFO.buildDate}</Typography>

        <Typography variant="caption" sx={{color: 'primary.light'}}>
          Env
        </Typography>
        <Box
          component="span"
          sx={
            isDev
              ? {
                  bgcolor: 'rgba(25, 118, 210, 0.2)',
                  border: '1px solid rgba(25, 118, 210, 0.5)',
                  borderRadius: 0.5,
                  px: 0.5,
                  color: '#90caf9',
                  fontSize: '0.7rem',
                }
              : {fontSize: '0.7rem'}
          }
        >
          {BUILD_INFO.env}
        </Box>
      </Box>
    </Box>
  );
}

export function AppVersionChip() {
  const label = `v${BUILD_INFO.version} · ${BUILD_INFO.gitSha} · ${BUILD_INFO.buildDate}`;
  return (
    <Tooltip title={<VersionTooltip />} placement="bottom-end">
      <Box
        aria-label={`App version: ${label}`}
        sx={{
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '12px',
          px: 1.25,
          py: 0.375,
          mx: 1,
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.75)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:web -- --reporter=verbose --testPathPattern=AppVersionChip
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/client-web/app/components/AppVersionChip.tsx apps/client-web/tests/components/AppVersionChip.test.tsx
git commit -m "feat: add AppVersionChip component with version, git SHA and build date"
```

---

## Task 3: Wire AppVersionChip into the AppBar

**Files:**
- Modify: `apps/client-web/app/components/Layout.tsx`

- [ ] **Step 1: Add the import to `Layout.tsx`**

Near the top of the file, alongside the other component imports (around line 89–94):

```ts
import {AppVersionChip} from './AppVersionChip';
```

- [ ] **Step 2: Insert `<AppVersionChip />` in the Toolbar**

In the `<Toolbar>` JSX, insert `<AppVersionChip />` immediately after the app name `<Typography>` and before the Theme `<Tooltip>`:

```tsx
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{flexGrow: 1, fontWeight: 600, color: 'primary.contrastText'}}
          >
            {t('common:appName')}
          </Typography>

          <AppVersionChip />

          <Tooltip title="Theme">
```

- [ ] **Step 3: Run typecheck to confirm no type errors**

```bash
npm run typecheck:web
```

Expected: no errors.

- [ ] **Step 4: Start the dev server and visually verify**

```bash
npm run dev:web
```

Open `http://localhost:3004` and confirm:
- The chip `v0.0.1 · <sha> · <date>` appears in the AppBar between the app name and the theme icon.
- Hovering the chip shows the tooltip with Version, Build, Date, and Env rows.
- The Env row shows a blue badge in dev mode.
- The chip is not clickable (cursor is default).
- The chip is present in both sidebar-collapsed and sidebar-expanded states.

- [ ] **Step 5: Commit**

```bash
git add apps/client-web/app/components/Layout.tsx
git commit -m "feat: show app version chip in AppBar"
```
