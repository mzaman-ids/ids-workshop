import {useQuery} from '@tanstack/react-query';
import {useAuth} from 'core/contexts/auth/useAuth';
import {stockAdjustmentQueries} from '../queries/stockAdjustmentQueries';
import {STOCK_ADJUSTMENT_QUERY_KEYS} from '../queries/stockAdjustmentQueryKey';
import type {AdjustmentType} from '../types/stockAdjustment';

type UseStockAdjustmentsOptions = {
  locationId: string;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  type?: AdjustmentType;
  partNumber?: string;
};

export function useStockAdjustments(options: UseStockAdjustmentsOptions) {
  const {accessToken} = useAuth();
  const {locationId, page = 1, pageSize = 25, searchTerm, type, partNumber} = options;

  return useQuery({
    queryKey: STOCK_ADJUSTMENT_QUERY_KEYS.list(locationId, {
      page,
      pageSize,
      searchTerm,
      type,
      partNumber,
    }),
    queryFn: ({signal}) => {
      if (!accessToken) {
        throw new Error('No access token');
      }
      return stockAdjustmentQueries.fetchAll({
        locationId,
        page,
        pageSize,
        searchTerm: searchTerm || undefined,
        type,
        partNumber: partNumber || undefined,
        signal,
        token: accessToken,
      });
    },
    enabled: !!accessToken && !!locationId,
  });
}
