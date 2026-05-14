import {useQuery} from '@tanstack/react-query';
import {useAuth} from 'core/contexts/auth/useAuth';
import {vendorQueries} from '../queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from '../queries/vendorQueryKey';

export function useVendor(id: string) {
  const {accessToken} = useAuth();

  return useQuery({
    queryKey: VENDOR_QUERY_KEYS.detail(id),
    queryFn: ({signal}) => vendorQueries.fetchById({id, signal, token: accessToken ?? ''}),
    enabled: !!accessToken && !!id,
  });
}
