import type { Dispatch, SetStateAction } from 'react';
import type { IInvoice, IInvoiceFile, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import type { DraftFieldErrors, DraftInvoiceForm } from '@/features/invoices/invoice-field-access';

/** Конфигурация рендера одной колонки таблицы сгруппированных счетов. */
export interface InvoiceColumnRenderer {
  width: number;
  header: string;
  renderCell: (invoice: IInvoice) => React.ReactNode;
  renderDraft: () => React.ReactNode;
}

/** Общие пропсы/контекст для фабрик рендереров колонок. */
export interface GroupedInvoiceTableColumnRenderersParams {
  draftForm?: DraftInvoiceForm;
  draftErrors: DraftFieldErrors;
  amountFocused: boolean;
  amountDisplay: string;
  counterpartyResults?: string[];
  permissions: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canViewHistory: boolean;
    canMove: boolean;
    canPay: boolean;
    canMarkPayment: boolean;
    canRemoveApprovalMark: boolean;
    canViewPaymentMarks: boolean;
    canManageFiles: boolean;
  };
  marksByInvoice: Record<string, IPaymentMark>;
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  userMap:
    | Map<string, { id: string; name?: string; email?: string } | undefined>
    | Record<string, { name?: string; email?: string } | undefined>;
  onEdit: (invoice: IInvoice) => void;
  onCopy?: (invoice: IInvoice) => void;
  onDelete: (invoice: IInvoice) => void;
  onHistory: (invoice: IInvoice) => void;
  onMove: (invoice: IInvoice) => void;
  onFiles?: (invoice: IInvoice) => void;
  onMarkForPayment?: (invoice: IInvoice) => void;
  onMarkForApproval?: (invoice: IInvoice) => void;
  onClearPaymentMark?: (markId: string) => void;
  onApproveMark?: (markId: string) => void;
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  handleDraftChange: (field: keyof DraftInvoiceForm, value: unknown) => void;
  handleDraftKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  setAmountDisplay: Dispatch<SetStateAction<string>>;
  setAmountFocused: Dispatch<SetStateAction<boolean>>;
  setDraftErrors: Dispatch<SetStateAction<DraftFieldErrors>>;
  setPayModalInvoice: Dispatch<SetStateAction<IInvoice | null>>;
  setPayModalAmount: Dispatch<SetStateAction<string>>;
  setClearConfirmInvoiceId: Dispatch<SetStateAction<string | null>>;
  setPartialModal: Dispatch<
    SetStateAction<{ invoice: IInvoice; amount: string; comment: string } | null>
  >;
}

/** Набор рендереров всех колонок таблицы. */
export type GroupedInvoiceTableColumnRenderers = Record<InvoiceColumnId, InvoiceColumnRenderer>;

/** Общий стиль для полей ввода в строке черновика. */
export const DRAFT_INPUT_STYLE = {
  fontWeight: 600,
  fontSize: 13,
} as const;
