export interface HistoryDiff {
  key: string;
  from: unknown;
  to: unknown;
}

export type ActionKind =
  | 'payment'
  | 'payment_removed'
  | 'copy_created'
  | 'mark'
  | 'edit'
  | 'file_added'
  | 'file_removed'
  | 'invoice_deleted'
  | 'invoice_restored';

/** Готовая к показу запись истории: событие + список изменений «было → стало». */
export interface HistoryEntryDiffs {
  entryId: string;
  changedAt: string;
  author: string;
  isCopy: boolean;
  kind: ActionKind;
  actionText: string;
  diffs: HistoryDiff[];
  fileLink?: string;
}

export interface InvoiceHistoryModalProps {
  invoiceId: string | null;
  invoiceLabel: string;
  opened: boolean;
  onClose: () => void;
}
