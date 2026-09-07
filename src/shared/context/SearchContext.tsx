import { createContext, useContext, useState, type ReactNode } from 'react';
import { useDebouncedValue } from '@mantine/hooks';

interface SearchContextValue {
  searchText: string;
  setSearchText: (text: string) => void;
  debouncedSearchText: string;
  searchAll: boolean;
  setSearchAll: (all: boolean) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText] = useDebouncedValue(searchText, 500);
  const [searchAll, setSearchAll] = useState(false);

  return (
    <SearchContext.Provider value={{ searchText, setSearchText, debouncedSearchText, searchAll, setSearchAll }}>
      {children}
    </SearchContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}
