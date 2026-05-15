export const BUILD_INFO = {
  version: import.meta.env.VITE_APP_VERSION ?? 'dev',
  gitSha: import.meta.env.VITE_GIT_SHA ?? 'local',
  buildDate: import.meta.env.VITE_BUILD_DATE ?? 'unknown',
  env: import.meta.env.MODE,
} as const;
