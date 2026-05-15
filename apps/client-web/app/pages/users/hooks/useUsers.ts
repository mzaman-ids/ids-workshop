import {useQuery} from '@tanstack/react-query';
import {useAuth} from 'core/contexts/auth/useAuth';
import {userQueries} from '../queries/userQueries';
import {USER_QUERY_KEYS} from '../queries/userQueryKey';

type UseUsersOptions = {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  isDeleted?: boolean;
};

export function useUsers(options: UseUsersOptions = {}) {
  const {accessToken} = useAuth();
  const {page = 1, pageSize = 10, searchTerm = '', isDeleted} = options;

  return useQuery({
    queryKey: USER_QUERY_KEYS.list({page, pageSize, searchTerm, isDeleted}),
    queryFn: ({signal}) => {
      if (!accessToken) {
        throw new Error('No access token available');
      }
      return userQueries.fetchAll({
        page,
        pageSize,
        searchTerm: searchTerm || undefined,
        isDeleted,
        signal,
        token: accessToken,
      });
    },
    enabled: !!accessToken,
    placeholderData: (previousData) => previousData,
  });
}
