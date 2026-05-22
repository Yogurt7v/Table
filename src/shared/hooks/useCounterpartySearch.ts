import { useEffect, useState } from 'react';
import { searchCounterparties } from '@/api/collections';

export function useCounterpartySearch(orgId: string, query: string) {
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(() => {
      searchCounterparties(orgId, query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setIsLoading(false));
    }, 700);

    return () => clearTimeout(timeout);
  }, [orgId, query]);

  return { results, isLoading };
}
