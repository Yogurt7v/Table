import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { DocumentStatusFilter } from '@/features/documents/hooks/use-docs-page/docs-page-types';

export interface DocsPageToolbarProps {
  paymentDateRange: [Date | null, Date | null];
  invoiceDateRange: [Date | null, Date | null];
  onPaymentDateRangeChange: (value: [Date | null, Date | null]) => void;
  onInvoiceDateRangeChange: (value: [Date | null, Date | null]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  filterRef: RefObject<HTMLDivElement | null>;
  filterOpened: boolean;
  setFilterOpened: Dispatch<SetStateAction<boolean>>;
  activeFilterCount: number;
  sortOrder: 'new' | 'old' | null;
  setSortOrder: Dispatch<SetStateAction<'new' | 'old' | null>>;
  statusFilter: DocumentStatusFilter | null;
  setStatusFilter: Dispatch<SetStateAction<DocumentStatusFilter | null>>;
  counterpartyOptions: string[];
  filterCounterparty: string;
  setFilterCounterparty: Dispatch<SetStateAction<string>>;
  objects: { id: string; name: string }[];
  objectOptions: { value: string; label: string }[];
  filterObjectIds: string[];
  setFilterObjectIds: Dispatch<SetStateAction<string[]>>;
  resetFilters: () => void;
  collapsedAll: boolean;
  onToggleCollapseAll: () => void;
  canCreate: boolean;
  onCreate: () => void;
  setPages: Dispatch<SetStateAction<Record<string, number>>>;
}
