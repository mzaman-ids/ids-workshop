/// <reference types='vitest' />
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import type {IncomingMessage, ServerResponse} from 'node:http';
import path from 'node:path';
import {reactRouter} from '@react-router/dev/vite';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8')) as {
    version: string;
  };

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
        // Pre-transform all route and component modules on startup so Vite discovers
        // their deps before first navigation, preventing mid-session optimizer reloads.
        clientFiles: ['./app/pages/**/*.tsx', './app/components/**/*.tsx'],
      },
    },
    preview: {
      port: 4300,
      host: 'localhost',
    },
    plugins: [
      !process.env.VITEST && reactRouter(),
      // Suppress Chrome DevTools well-known URL errors
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
        // TODO: Remove stubs once @ids/data-models is split into sub-path exports.
        // These packages are backend-only (NestJS). The shared @ids/data-models barrel
        // re-exports decorated DTOs that import them, causing CJS/ESM failures in the browser.
        // No-op stubs replace them entirely in client builds.
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
