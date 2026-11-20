import { useState, useMemo, useEffect } from 'react';
import type { IInvoice, IInvoiceFile, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import { useUserMap } from '@/features/admin/hooks/useUserMap';
import { useAutoScrollIntoView } from '@/shared/hooks/useAutoScrollIntoView';
import { groupInvoicesByCounterparty } from '@/shared/utils/group-invoices';
import type { DraftInvoiceForm, InvoiceEditableField } from '../../model/invoice-field-access';
import { GroupedInvoiceTableDesktop } from './GroupedInvoiceTableDesktop';
import { GroupedInvoiceTableEmptyState } from './GroupedInvoiceTableEmptyState';
import { GroupedInvoiceTableModals } from './GroupedInvoiceTableModals';
import { useGroupedInvoiceTableColumnSizing } from './useGroupedInvoiceTableColumnSizing';
import { useGroupedInvoiceTableDragDrop } from './useGroupedInvoiceTableDragDrop';
import { useGroupedInvoiceTableColumnRenderers } from './useGroupedInvoiceTableColumnRenderers';
import { useGroupedInvoiceTableDraft } from './useGroupedInvoiceTableDraft';
import { InvoiceMobileCardView } from '../invoice-mobile-card-view/InvoiceMobileCardView';

/** Пропсы таблицы счетов с группировкой по контрагентам. */
interface GroupedInvoiceTableProps {
  orgId: string;
  invoices: IInvoice[];
  isDraftOpen: boolean;
  hasDraftElsewhere?: boolean;
  draftForm?: DraftInvoiceForm;
  counterpartyResults?: string[];
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onDraftSave?: () => void;
  onDraftCancel?: () => void;
  onEdit: (invoice: IInvoice) => void;
  onCopy?: (invoice: IInvoice) => void;
  onDelete: (invoice: IInvoice) => void;
  onHistory: (invoice: IInvoice) => void;
  onMove: (invoice: IInvoice) => void;
  onPayInvoice: (invoiceId: string, amount: number) => void;
  onClearPayment: (invoiceId: string) => void;
  highlightedIds: string[];
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
    canViewPaidDate: boolean;
    canManageFiles: boolean;
    canEditField?: (field: InvoiceEditableField) => boolean;
  };
  paymentMarks?: IPaymentMark[];
  onMarkForPayment?: (invoice: IInvoice) => void;
  onMarkForApproval?: (invoice: IInvoice) => void;
  onMarkPartialPayment?: (invoiceId: string, amount: number | undefined, comment: string) => void;
  onClearPaymentMark?: (markId: string) => void;
  onApproveMark?: (markId: string) => void;
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  onFiles?: (invoice: IInvoice) => void;
  visibleColumns: InvoiceColumnId[];
  onReorderGroups?: (counterpartyOrder: string[]) => void;
  onAddClick?: () => void;
  allInvoices?: IInvoice[];
  counterpartyOrder?: string[];
}

/**
 * Таблица счетов, сгруппированных по контрагентам.
 *
 * Оркестратор: держит состояние (модалки, черновик), группирует счета и
 * распределяет колонки по правам. Рендер — мобильные карточки
 * (`InvoiceMobileCardView`), десктопная таблица (`GroupedInvoiceTableDesktop`),
 * пустое состояние (`GroupedInvoiceTableEmptyState`) и модалки
 * (`GroupedInvoiceTableModals`). Отображение колонок и доступные действия
 * определяются правами пользователя.
 */
export function GroupedInvoiceTable({
  orgId,
  invoices,
  allInvoices,
  counterpartyOrder,
  isDraftOpen,
  hasDraftElsewhere = false,
  draftForm,
  counterpartyResults,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onEdit,
  onCopy,
  onDelete,
  onHistory,
  onMove,
  onPayInvoice,
  onClearPayment,
  highlightedIds,
  permissions,
  paymentMarks,
  onMarkForPayment,
  onMarkForApproval,
  onMarkPartialPayment,
  onClearPaymentMark,
  onApproveMark,
  filesByInvoice,
  onFiles,
  visibleColumns,
  onReorderGroups,
  onAddClick,
}: GroupedInvoiceTableProps) {
  const userMap = useUserMap();
  const groups = useMemo(
    () => groupInvoicesByCounterparty(invoices, allInvoices, counterpartyOrder),
    [invoices, allInvoices, counterpartyOrder],
  );
  const canDrag = permissions.canMove;

  const draftRowRef = useAutoScrollIntoView<HTMLTableRowElement>({
    enabled: isDraftOpen && !!draftForm,
  });

  // Отметка к оплате по счёту: одна на счёт, ключ — invoice_id.
  const marksByInvoice = useMemo(() => {
    const map: Record<string, IPaymentMark> = {};
    if (paymentMarks) {
      paymentMarks.forEach((mark) => {
        map[mark.invoice_id] = mark;
      });
    }
    return map;
  }, [paymentMarks]);

  const [partialModal, setPartialModal] = useState<{
    invoice: IInvoice;
    amount: string;
    comment: string;
  } | null>(null);
  const [payModalInvoice, setPayModalInvoice] = useState<IInvoice | null>(null);
  const [payModalAmount, setPayModalAmount] = useState<string>('');
  const [clearConfirmInvoiceId, setClearConfirmInvoiceId] = useState<string | null>(null);

  const {
    draftErrors,
    setDraftErrors,
    discardConfirmOpen,
    setDiscardConfirmOpen,
    amountFocused,
    setAmountFocused,
    amountDisplay,
    setAmountDisplay,
    requestDraftCancel,
    handleDraftSaveClick,
    handleDraftChange,
    handleDraftKeyDown,
  } = useGroupedInvoiceTableDraft({
    draftForm,
    onDraftChange,
    onDraftSave,
    onDraftCancel,
  });

  // Колонки по правам: отметки и дата оплаты — по своим флагам, «действия» —
  // если есть хоть одно право на изменение.
  const filteredColumns = useMemo(
    () =>
      visibleColumns.filter((colId) => {
        if (colId === 'payment_mark') return permissions.canViewPaymentMarks;
        if (colId === 'paid_date') return permissions.canViewPaidDate;
        if (colId === 'actions')
          return (
            permissions.canUpdate ||
            permissions.canDelete ||
            permissions.canViewHistory ||
            permissions.canMove ||
            permissions.canManageFiles
          );
        return true;
      }),
    [visibleColumns, permissions],
  );

  const { columnSizing, handleResizeStart } = useGroupedInvoiceTableColumnSizing({ orgId });

  // Сумма черновика — строковое поле ввода; синхронизируем с формой при её
  // появлении, чтобы инпут не показывал старое значение.
  useEffect(() => {
    setAmountDisplay(String(draftForm?.amount ?? 0));
    setAmountFocused(false);
  }, [draftForm, setAmountDisplay, setAmountFocused]);

  const { sensors, handleDragEnd } = useGroupedInvoiceTableDragDrop({ groups, onReorderGroups });

  /** Оплата строки-копии (`id` с суффиксом `__r`) уходит родителю. */
  function handlePaySubmit(invoice: IInvoice, amount: number) {
    if (invoice.id.endsWith('__r')) {
      const parentId = invoice.id.slice(0, -3);
      onPayInvoice(parentId, amount);
    } else {
      onPayInvoice(invoice.id, amount);
    }
  }

  const columnRenderers = useGroupedInvoiceTableColumnRenderers({
    draftForm,
    draftErrors,
    amountFocused,
    amountDisplay,
    counterpartyResults,
    permissions,
    marksByInvoice,
    filesByInvoice,
    userMap,
    onEdit,
    onCopy,
    onDelete,
    onHistory,
    onMove,
    onFiles,
    onMarkForPayment,
    onMarkForApproval,
    onClearPaymentMark,
    onApproveMark,
    onDraftChange,
    handleDraftChange,
    handleDraftKeyDown,
    setAmountDisplay,
    setAmountFocused,
    setDraftErrors,
    setPayModalInvoice,
    setPayModalAmount,
    setClearConfirmInvoiceId,
    setPartialModal,
  });

  // Пустая дата без черновика — короткое состояние вместо всей таблицы.
  if (groups.length === 0 && !isDraftOpen) {
    return (
      <GroupedInvoiceTableEmptyState canCreate={permissions.canCreate} onAddClick={onAddClick} />
    );
  }

  // Мобильный вид, десктопная таблица и модалки: карточки видны всегда,
  // таблица — только с sm, модалки — поверх обоих.
  return (
    <>
      <InvoiceMobileCardView
        invoices={invoices}
        allInvoices={allInvoices}
        counterpartyOrder={counterpartyOrder}
        marksByInvoice={marksByInvoice}
        filesByInvoice={filesByInvoice}
        highlightedIds={highlightedIds}
        permissions={permissions}
        isDraftOpen={isDraftOpen}
        draftForm={draftForm}
        counterpartyResults={counterpartyResults}
        onDraftChange={onDraftChange}
        onDraftSave={onDraftSave}
        onDraftCancel={onDraftCancel}
        onMarkForPayment={onMarkForPayment}
        onMarkForApproval={onMarkForApproval}
        onClearPaymentMark={onClearPaymentMark}
        onApproveMark={onApproveMark}
        onClearPaymentConfirm={(id) => setClearConfirmInvoiceId(id)}
        onOpenPartialModal={(inv) => setPartialModal({ invoice: inv, amount: '', comment: '' })}
        onDelete={onDelete}
      />

      <GroupedInvoiceTableDesktop
        groups={groups}
        canDrag={canDrag}
        canCreate={permissions.canCreate}
        hasDraftElsewhere={hasDraftElsewhere}
        isDraftOpen={isDraftOpen}
        draftForm={draftForm}
        draftRowRef={draftRowRef}
        filteredColumns={filteredColumns}
        columnRenderers={columnRenderers}
        columnSizing={columnSizing}
        handleResizeStart={handleResizeStart}
        sensors={sensors}
        handleDragEnd={handleDragEnd}
        marksByInvoice={marksByInvoice}
        highlightedIds={highlightedIds}
        onAddClick={onAddClick}
        onDraftSave={handleDraftSaveClick}
        onDraftCancel={requestDraftCancel}
        setClearConfirmInvoiceId={setClearConfirmInvoiceId}
      />

      {/* Модальные окна: оплата, частичная отметка и подтверждения */}
      <GroupedInvoiceTableModals
        payModalInvoice={payModalInvoice}
        payModalAmount={payModalAmount}
        onPayModalClose={() => {
          setPayModalInvoice(null);
          setPayModalAmount('');
        }}
        onPayModalAmountChange={(v) => setPayModalAmount(v)}
        onPaySubmit={handlePaySubmit}
        partialModal={partialModal}
        onPartialModalClose={() => setPartialModal(null)}
        onPartialAmountChange={(v) =>
          setPartialModal((prev) => (prev ? { ...prev, amount: v } : null))
        }
        onPartialCommentChange={(v) =>
          setPartialModal((prev) => (prev ? { ...prev, comment: v } : null))
        }
        onPartialSave={onMarkPartialPayment}
        clearConfirmInvoiceId={clearConfirmInvoiceId}
        onClearConfirmClose={() => setClearConfirmInvoiceId(null)}
        onClearPayment={onClearPayment}
        discardConfirmOpen={discardConfirmOpen}
        onDiscardConfirmClose={() => setDiscardConfirmOpen(false)}
        onDiscardConfirm={() => {
          setDiscardConfirmOpen(false);
          setDraftErrors({});
          onDraftCancel?.();
        }}
      />
    </>
  );
}
