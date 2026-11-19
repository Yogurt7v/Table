import type {
  IAccountingObject,
  IInvoice,
  IInvoiceFile,
  IPaymentMark,
  InvoiceColumnId,
} from '@/shared/types';
import type { InvoiceFilterType } from '@/features/invoices/utils/invoice-filter';

/** Пропсы списка объектов секции счетов (шапка, фильтры, группы и скрытые объекты). */
export interface InvoiceSectionObjectsListProps {
  orgId: string;
  date: string;
  objects: IAccountingObject[];
  hiddenObjects: IAccountingObject[];
  allObjects: IAccountingObject[];
  invoices: IInvoice[] | undefined;
  highlightedIds: string[];
  hasSearch: boolean;
  draftObjectId: string | null;
  permissions: { canCreate: boolean; role: string | null };
  paymentMarks: IPaymentMark[] | undefined;
  filesByInvoice: Record<string, IInvoiceFile[]>;
  visibleColumns: InvoiceColumnId[];
  onOpenDraft: (id: string) => void;
  onCancelDraft: () => void;
  onPrint?: (objId: string) => void;
  onExport?: (objId: string) => void;
  onColumnSettingsClick: () => void;
  onPrintAll: () => void;
  onExportAll: () => void;
  activeFilters: InvoiceFilterType[];
  onActiveFiltersChange: (filters: InvoiceFilterType[]) => void;
  paidTodayTotal: number;
}
