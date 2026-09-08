import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface InvoiceNavigationContextValue {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  highlightedInvoiceId: string | null;
  highlightRequestId: number;
  requestHighlight: (invoiceId: string, date: Date) => void;
  clearHighlight: () => void;
}

const InvoiceNavigationContext = createContext<InvoiceNavigationContextValue | null>(null);

export function InvoiceNavigationProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState<Date>(() => new Date());
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);
  const [highlightRequestId, setHighlightRequestId] = useState(0);

  const setSelectedDate = useCallback((date: Date) => {
    setSelectedDateState(date);
  }, []);

  const requestHighlight = useCallback((invoiceId: string, date: Date) => {
    setSelectedDateState(date);
    setHighlightedInvoiceId(invoiceId);
    setHighlightRequestId((r) => r + 1);
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedInvoiceId(null);
  }, []);

  return (
    <InvoiceNavigationContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        highlightedInvoiceId,
        highlightRequestId,
        requestHighlight,
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
