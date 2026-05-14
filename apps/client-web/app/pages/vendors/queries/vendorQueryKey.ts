export const VENDOR_QUERY_KEYS = {
  all: () => ['vendors'] as const,
  list: (filters?: Record<string, unknown>) => ['vendors', 'list', filters ?? {}] as const,
  detail: (id: string) => ['vendors', 'detail', id] as const,
} as const;
