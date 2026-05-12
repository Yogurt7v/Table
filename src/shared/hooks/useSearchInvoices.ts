import { useQuery } from '@tanstack/react-query';
import { searchAllInvoices } from '@/api/collections';
import { useSearch } from '@/shared/context/SearchContext';

export function useSearchInvoices(orgId: string) {
  const { searchText, searchAll } = useSearch();

  return useQuery({
    queryKey: ['invoices', 'search', orgId, searchText],
    queryFn: () => searchAllInvoices(orgId, searchText),
    enabled: searchAll && !!searchText && !!orgId,
  });
}
