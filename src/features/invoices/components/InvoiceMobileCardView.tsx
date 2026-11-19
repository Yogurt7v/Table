import { Stack } from '@mantine/core';
import { groupInvoicesByCounterparty } from '@/shared/utils/group-invoices';
import { InvoiceMobileCardDraft } from './invoice-mobile-card-view/InvoiceMobileCardDraft';
import { InvoiceMobileCardGroup } from './invoice-mobile-card-view/InvoiceMobileCardGroup';
import { useInvoiceMobileCardDraft } from './invoice-mobile-card-view/useInvoiceMobileCardDraft';
import type { InvoiceMobileCardViewProps } from './invoice-mobile-card-view/invoice-mobile-card-view-types';

export type { InvoiceMobileCardViewProps } from './invoice-mobile-card-view/invoice-mobile-card-view-types';

/**
 * Мобильное представление счетов: группы по контрагентам с карточками счетов
 * и (при открытии) карточка черновика нового счёта. Видно только до `sm`.
 */
export function InvoiceMobileCardView({
  invoices,
  allInvoices,
  counterpartyOrder,
  marksByInvoice,
  filesByInvoice,
  highlightedIds,
  permissions,
  isDraftOpen,
  draftForm,
  counterpartyResults,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onClearPaymentMark,
  onMarkForPayment,
  onMarkForApproval,
  onClearPaymentConfirm,
  onOpenPartialModal,
  onApproveMark,
  onDelete,
}: InvoiceMobileCardViewProps) {
  const groups = groupInvoicesByCounterparty(invoices, allInvoices, counterpartyOrder);
  const {
    draftCardRef,
    draftErrors,
    setDraftErrors,
    discardConfirmOpen,
    setDiscardConfirmOpen,
    requestDraftCancel,
    handleDraftSaveClick,
    handleDraftChange,
    handleDraftKeyDown,
  } = useInvoiceMobileCardDraft({
    isDraftOpen,
    draftForm,
    onDraftChange,
    onDraftSave,
    onDraftCancel,
  });

  // Список групп контрагентов; черновик (если открыт) — отдельной карточкой ниже.
  return (
    <Stack hiddenFrom="sm" gap="md">
      {groups.map((group) => (
        <InvoiceMobileCardGroup
          key={group.counterparty}
          group={group}
          groups={groups}
          marksByInvoice={marksByInvoice}
          filesByInvoice={filesByInvoice}
          highlightedIds={highlightedIds}
          permissions={permissions}
          onMarkForPayment={onMarkForPayment}
          onMarkForApproval={onMarkForApproval}
          onClearPaymentMark={onClearPaymentMark}
          onClearPaymentConfirm={onClearPaymentConfirm}
          onOpenPartialModal={onOpenPartialModal}
          onApproveMark={onApproveMark}
          onDelete={onDelete}
        />
      ))}

      {isDraftOpen && draftForm && (
        <InvoiceMobileCardDraft
          draftForm={draftForm}
          draftErrors={draftErrors}
          draftCardRef={draftCardRef}
          counterpartyResults={counterpartyResults}
          onDraftChange={onDraftChange}
          onFieldChange={handleDraftChange}
          onFieldKeyDown={handleDraftKeyDown}
          onSave={handleDraftSaveClick}
          onRequestCancel={requestDraftCancel}
          discardConfirmOpen={discardConfirmOpen}
          onDiscardClose={() => setDiscardConfirmOpen(false)}
          onDiscardConfirm={() => {
            setDiscardConfirmOpen(false);
            setDraftErrors({});
            onDraftCancel?.();
          }}
        />
      )}
    </Stack>
  );
}
