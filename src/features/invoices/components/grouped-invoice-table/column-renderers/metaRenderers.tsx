import { InvoiceActionsCell } from '@/features/invoices/components/InvoiceActionsCell';
import { PaymentMarkCell } from '@/features/invoices/components/PaymentMarkCell';
import { getInitiatorDisplayName } from '@/shared/utils/user-display-name';
import type { GroupedInvoiceTableColumnRenderersParams, InvoiceColumnRenderer } from './types';

/** Рендереры служебных колонок: действия, отметка оплаты и инициатор. */
export function createMetaColumnRenderers(
  params: Pick<
    GroupedInvoiceTableColumnRenderersParams,
    | 'permissions'
    | 'onEdit'
    | 'onCopy'
    | 'onDelete'
    | 'onHistory'
    | 'onMove'
    | 'onFiles'
    | 'marksByInvoice'
    | 'onMarkForPayment'
    | 'onMarkForApproval'
    | 'onClearPaymentMark'
    | 'onApproveMark'
    | 'setPartialModal'
    | 'userMap'
  >,
): {
  actions: InvoiceColumnRenderer;
  payment_mark: InvoiceColumnRenderer;
  initiator: InvoiceColumnRenderer;
} {
  const {
    permissions,
    onEdit,
    onCopy,
    onDelete,
    onHistory,
    onMove,
    onFiles,
    marksByInvoice,
    onMarkForPayment,
    onMarkForApproval,
    onClearPaymentMark,
    onApproveMark,
    setPartialModal,
    userMap,
  } = params;

  return {
    actions: {
      width: 50,
      header: 'Действия',
      renderCell: (invoice) => (
        <InvoiceActionsCell
          invoice={invoice}
          canUpdate={permissions.canUpdate}
          canDelete={permissions.canDelete}
          canViewHistory={permissions.canViewHistory}
          canMove={permissions.canMove}
          canCreate={permissions.canCreate}
          onEdit={onEdit}
          onDelete={onDelete}
          onHistory={onHistory}
          onMove={onMove}
          onFiles={onFiles}
          onCopy={onCopy}
        />
      ),
      renderDraft: () => null,
    },
    payment_mark: {
      width: 180,
      header: 'Отметка',
      renderCell: (invoice) => {
        const lookupId = invoice.id.endsWith('__r') ? invoice.id.slice(0, -3) : invoice.id;
        const mark = invoice.paid ? undefined : marksByInvoice[lookupId];
        return (
          <PaymentMarkCell
            invoice={invoice}
            mark={mark}
            canMarkPayment={permissions.canMarkPayment}
            canViewPaymentMarks={permissions.canViewPaymentMarks}
            canRemoveApprovalMark={permissions.canRemoveApprovalMark}
            onMarkForPayment={onMarkForPayment}
            onMarkForApproval={onMarkForApproval}
            onOpenPartialModal={(inv) => setPartialModal({ invoice: inv, amount: '', comment: '' })}
            onClearPaymentMark={onClearPaymentMark}
            onApproveMark={onApproveMark}
          />
        );
      },
      renderDraft: () => null,
    },
    initiator: {
      width: 120,
      header: 'Инициатор',
      renderCell: (invoice) => (
        <>
          {getInitiatorDisplayName(invoice.created_by, invoice.created_by_name, userMap as never)}
        </>
      ),
      renderDraft: () => null,
    },
  };
}
