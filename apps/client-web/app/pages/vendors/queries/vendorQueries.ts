import {API_CONFIG} from 'core/config/api';
import {apiClient} from 'core/services/apiClient';
import type {
  CreateVendorInput,
  DbVendor,
  UpdateVendorInput,
  VendorListResponse,
  VendorSearchCriteria,
} from '../types/vendor';

export const vendorQueries = {
  fetchAll: async (criteria: VendorSearchCriteria): Promise<VendorListResponse> => {
    const params = new URLSearchParams({
      page: String(criteria.page ?? 1),
      pageSize: String(criteria.pageSize ?? 10),
    });
    if (criteria.searchTerm) {
      params.set('searchTerm', criteria.searchTerm);
    }
    return apiClient.get<VendorListResponse>(`${API_CONFIG.baseUrl}/vendors?${params.toString()}`, {
      signal: criteria.signal,
      token: criteria.token,
    });
  },

  fetchById: async ({
    id,
    signal,
    token,
  }: {
    id: string;
    signal?: AbortSignal;
    token: string;
  }): Promise<DbVendor> => {
    return apiClient.get<DbVendor>(`${API_CONFIG.baseUrl}/vendors/${id}`, {signal, token});
  },

  create: async (input: CreateVendorInput, token: string): Promise<DbVendor> => {
    return apiClient.post<DbVendor>(`${API_CONFIG.baseUrl}/vendors`, input, {token});
  },

  update: async (id: string, input: UpdateVendorInput, token: string): Promise<DbVendor> => {
    return apiClient.patch<DbVendor>(`${API_CONFIG.baseUrl}/vendors/${id}`, input, {token});
  },
};
