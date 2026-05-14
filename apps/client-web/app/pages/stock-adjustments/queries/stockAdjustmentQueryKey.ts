export const STOCK_ADJUSTMENT_QUERY_KEYS = {
  all: (locationId: string) => ['stock-adjustments', locationId] as const,
  list: (locationId: string, filters?: Record<string, unknown>) =>
    ['stock-adjustments', locationId, 'list', filters ?? {}] as const,
} as const;
