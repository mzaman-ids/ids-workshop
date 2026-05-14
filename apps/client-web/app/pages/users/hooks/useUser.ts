import {useQuery} from '@tanstack/react-query';
import {useAuth} from 'core/contexts/auth/useAuth';
import {userQueries} from '../queries/userQueries';
import {USER_QUERY_KEYS} from '../queries/userQueryKey';

export function useUser(logtoUserId: string) {
  const {accessToken} = useAuth();

  return useQuery({
    queryKey: USER_QUERY_KEYS.detail(logtoUserId),
    queryFn: ({signal}) =>
      userQueries.fetchById({logtoUserId, signal, token: accessToken ?? ''}),
    enabled: !!accessToken && !!logtoUserId,
  });
}
