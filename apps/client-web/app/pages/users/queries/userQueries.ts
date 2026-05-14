import {API_CONFIG} from 'core/config/api';
import {apiClient} from 'core/services/apiClient';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserListCriteria,
  UserListResponse,
  UserProfile,
} from '../types/user';

export const userQueries = {
  fetchAll: async (criteria: UserListCriteria): Promise<UserListResponse> => {
    const params = new URLSearchParams({
      page: String(criteria.page ?? 1),
      pageSize: String(criteria.pageSize ?? 10),
    });
    if (criteria.searchTerm) {
      params.set('searchTerm', criteria.searchTerm);
    }
    if (criteria.isDeleted !== undefined) {
      params.set('isDeleted', String(criteria.isDeleted));
    }
    return apiClient.get<UserListResponse>(
      `${API_CONFIG.baseUrl}/user?${params.toString()}`,
      {signal: criteria.signal, token: criteria.token},
    );
  },

  fetchById: async ({
    logtoUserId,
    signal,
    token,
  }: {
    logtoUserId: string;
    signal?: AbortSignal;
    token: string;
  }): Promise<UserProfile> => {
    return apiClient.get<UserProfile>(`${API_CONFIG.baseUrl}/user/${logtoUserId}`, {
      signal,
      token,
    });
  },

  create: async (
    input: CreateUserInput,
    token: string,
  ): Promise<{userId: string; email: string; message: string}> => {
    return apiClient.post<{userId: string; email: string; message: string}>(
      `${API_CONFIG.baseUrl}/user/register`,
      input,
      {token},
    );
  },

  update: async (
    logtoUserId: string,
    input: UpdateUserInput,
    token: string,
  ): Promise<UserProfile> => {
    return apiClient.patch<UserProfile>(`${API_CONFIG.baseUrl}/user/${logtoUserId}`, input, {
      token,
    });
  },

  deactivate: async (logtoUserId: string, token: string): Promise<UserProfile> => {
    return apiClient.delete<UserProfile>(`${API_CONFIG.baseUrl}/user/${logtoUserId}`, {token});
  },

  restore: async (logtoUserId: string, token: string): Promise<UserProfile> => {
    return apiClient.post<UserProfile>(
      `${API_CONFIG.baseUrl}/user/${logtoUserId}/restore`,
      {},
      {token},
    );
  },

  getProfile: async (token: string): Promise<UserProfile> => {
    return apiClient.get<UserProfile>(`${API_CONFIG.baseUrl}/user/profile`, {token});
  },

  updateProfile: async (input: UpdateUserInput, token: string): Promise<UserProfile> => {
    return apiClient.patch<UserProfile>(`${API_CONFIG.baseUrl}/user/profile`, input, {token});
  },

  uploadPhoto: async (logtoUserId: string, file: File, token: string): Promise<UserProfile> => {
    const form = new FormData();
    form.append('photo', file);
    return apiClient.postForm<UserProfile>(
      `${API_CONFIG.baseUrl}/user/${logtoUserId}/photo`,
      form,
      {token},
    );
  },

  deletePhoto: async (logtoUserId: string, token: string): Promise<UserProfile> => {
    return apiClient.delete<UserProfile>(`${API_CONFIG.baseUrl}/user/${logtoUserId}/photo`, {
      token,
    });
  },
};
