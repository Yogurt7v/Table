import { useEffect, useState } from 'react';
import { searchCounterparties } from '@/api/collections';

export function useCounterpartySearch(orgId: string, query: string) {
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
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
