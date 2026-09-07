import { useQuery } from '@tanstack/react-query';
import { searchAllInvoices } from '@/api/collections';
import { useSearch } from '@/shared/context/SearchContext';

export function useSearchInvoices(orgId: string) {
  const { debouncedSearchText, searchAll } = useSearch();

  return useQuery({
    queryKey: ['invoices', 'search', orgId, debouncedSearchText],
    queryFn: () => searchAllInvoices(orgId, debouncedSearchText),
    enabled: searchAll && !!debouncedSearchText && !!orgId,
  });
}
