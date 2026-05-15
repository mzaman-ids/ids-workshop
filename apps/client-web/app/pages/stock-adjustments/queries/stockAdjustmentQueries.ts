import {API_CONFIG} from 'core/config/api';
import {apiClient} from 'core/services/apiClient';
import type {
  CreateStockAdjustmentInput,
  DbStockAdjustmentListItem,
  DbStockAdjustmentListResponse,
  DbStockAdjustmentSearchCriteria,
} from '../types/stockAdjustment';

export const stockAdjustmentQueries = {
  fetchAll: async (
    criteria: DbStockAdjustmentSearchCriteria,
  ): Promise<DbStockAdjustmentListResponse> => {
    const params = new URLSearchParams({
      locationId: criteria.locationId,
      page: String(criteria.page ?? 1),
      pageSize: String(criteria.pageSize ?? 25),
    });
    if (criteria.searchTerm) {
      params.set('searchTerm', criteria.searchTerm);
    }
    if (criteria.type) {
      params.set('type', criteria.type);
    }
    if (criteria.partNumber) {
      params.set('partNumber', criteria.partNumber);
    }

    return apiClient.get<DbStockAdjustmentListResponse>(
      `${API_CONFIG.baseUrl}/stock-adjustments?${params.toString()}`,
      {signal: criteria.signal, token: criteria.token},
    );
  },

  create: async (
    input: CreateStockAdjustmentInput,
    token: string,
  ): Promise<DbStockAdjustmentListItem> => {
    return apiClient.post<DbStockAdjustmentListItem>(
      `${API_CONFIG.baseUrl}/stock-adjustments`,
      input,
      {token},
    );
  },
};
