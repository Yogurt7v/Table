import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '@/api/collections';

export function useInvoices(orgId: string, date: string) {
  return useQuery({
    queryKey: ['invoices', orgId, date],
    queryFn: () => getInvoices(orgId, date),
    enabled: !!orgId && !!date,
  });
}
