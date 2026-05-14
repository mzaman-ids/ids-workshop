import {useQuery} from '@tanstack/react-query';
import {useAuth} from 'core/contexts/auth/useAuth';
import {vendorQueries} from '../queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from '../queries/vendorQueryKey';

export function useVendors(params: {page: number; pageSize: number; searchTerm?: string}) {
  const {accessToken} = useAuth();

  return useQuery({
    queryKey: VENDOR_QUERY_KEYS.list(params),
    queryFn: ({signal}) => vendorQueries.fetchAll({...params, signal, token: accessToken ?? ''}),
    enabled: !!accessToken,
    placeholderData: (previousData) => previousData,
  });
}
