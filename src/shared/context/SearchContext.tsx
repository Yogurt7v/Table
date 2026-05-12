import { createContext, useContext, useState, type ReactNode } from 'react';

interface SearchContextValue {
  searchText: string;
  setSearchText: (text: string) => void;
  searchAll: boolean;
  setSearchAll: (all: boolean) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchText, setSearchText] = useState('');
  const [searchAll, setSearchAll] = useState(false);

  return (
    <SearchContext.Provider value={{ searchText, setSearchText, searchAll, setSearchAll }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}
