export const USER_QUERY_KEYS = {
  all: () => ['users'] as const,
  list: (filters?: Record<string, unknown>) => ['users', 'list', filters ?? {}] as const,
  detail: (logtoUserId: string) => ['users', 'detail', logtoUserId] as const,
} as const;
