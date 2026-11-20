import type { IInvoice, IInvoiceFile, IPaymentMark } from '@/shared/types';
import type { DraftInvoiceForm } from '@/features/invoices/model/invoice-field-access';

/** Права, влияющие на отображение действий и полей мобильной карточки счёта. */
export interface InvoiceMobileCardPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canViewHistory: boolean;
  canMove: boolean;
  canMarkPayment: boolean;
  canViewPaymentMarks: boolean;
  canRemoveApprovalMark?: boolean;
  canViewPaidDate: boolean;
  canManageFiles: boolean;
}

/** Пропсы мобильного представления счетов (карточки групп/счетов + черновик). */
export interface InvoiceMobileCardViewProps {
  invoices: IInvoice[];
  allInvoices?: IInvoice[];
  counterpartyOrder?: string[];
  marksByInvoice: Record<string, IPaymentMark>;
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  highlightedIds: string[];
  permissions: InvoiceMobileCardPermissions;
  isDraftOpen: boolean;
  draftForm?: DraftInvoiceForm;
  counterpartyResults?: string[];
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onDraftSave?: () => void;
  onDraftCancel?: () => void;
  onMarkForPayment?: (invoice: IInvoice) => void;
  onMarkForApproval?: (invoice: IInvoice) => void;
  onClearPaymentMark?: (markId: string) => void;
  onClearPaymentConfirm: (invoiceId: string) => void;
  onOpenPartialModal: (invoice: IInvoice) => void;
  onApproveMark?: (markId: string) => void;
  onDelete?: (invoice: IInvoice) => void;
}
