import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface InvoiceNavigationContextValue {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  highlightedInvoiceId: string | null;
  highlightRequestId: number;
  highlightDateCandidates: string[];
  requestHighlight: (invoiceId: string, date: Date) => void;
  requestHighlightWithCandidates: (invoiceId: string, dates: string[]) => void;
  clearHighlight: () => void;
}

const InvoiceNavigationContext = createContext<InvoiceNavigationContextValue | null>(null);

function dateFromYmd(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function InvoiceNavigationProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState<Date>(() => new Date());
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);
  const [highlightRequestId, setHighlightRequestId] = useState(0);
  const [highlightDateCandidates, setHighlightDateCandidates] = useState<string[]>([]);

  const setSelectedDate = useCallback((date: Date) => {
    setSelectedDateState(date);
  }, []);

  const requestHighlight = useCallback((invoiceId: string, date: Date) => {
    setHighlightDateCandidates([]);
    setSelectedDateState(date);
    setHighlightedInvoiceId(invoiceId);
    setHighlightRequestId((r) => r + 1);
  }, []);

  const requestHighlightWithCandidates = useCallback((invoiceId: string, dates: string[]) => {
    const [first] = dates;
    if (first) setSelectedDateState(dateFromYmd(first));
    setHighlightDateCandidates(dates);
    setHighlightedInvoiceId(invoiceId);
    setHighlightRequestId((r) => r + 1);
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedInvoiceId(null);
    setHighlightDateCandidates([]);
  }, []);

  return (
    <InvoiceNavigationContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        highlightedInvoiceId,
        highlightRequestId,
        highlightDateCandidates,
        requestHighlight,
        requestHighlightWithCandidates,
        clearHighlight,
      }}
    >
      {children}
    </InvoiceNavigationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInvoiceNavigation() {
  const ctx = useContext(InvoiceNavigationContext);
  if (!ctx) throw new Error('useInvoiceNavigation must be used within InvoiceNavigationProvider');
  return ctx;
}
