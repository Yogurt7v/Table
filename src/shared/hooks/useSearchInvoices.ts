import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/api/client';
import { getAllInvoices } from '@/api/collections';
import { useSearch } from '@/shared/context/SearchContext';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';

function useAllInvoices(orgId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId || !enabled) return;
    const sub = pb.collection('invoices').subscribe('*', () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'all', orgId] });
    });
    return () => {
      sub.then((unsub) => unsub());
    };
  }, [enabled, orgId, queryClient]);

  return useQuery({
    queryKey: ['invoices', 'all', orgId],
    queryFn: () => getAllInvoices(orgId),
    enabled: enabled && !!orgId,
    retry: false,
  });
}

export function useSearchInvoices(orgId: string) {
  const { debouncedSearchText, searchAll } = useSearch();
  const query = foldSearchText(debouncedSearchText);
  const enabled = searchAll && !!query && !!orgId;

  const { data: allInvoices, isLoading } = useAllInvoices(orgId, enabled);

  const data = useMemo(() => {
    if (!enabled || !allInvoices) return undefined;
    return allInvoices.filter((inv) =>
      matchesFolded([inv.counterparty, inv.purpose, inv.contract_no, inv.invoice_no, inv.comment], query),
    );
  }, [allInvoices, enabled, query]);

  return { data, isLoading };
}