import { Autocomplete, TextInput } from '@mantine/core';
import type { IInvoice } from '@/shared/types';
import type { GroupedInvoiceTableColumnRenderersParams, InvoiceColumnRenderer } from './types';
import { DRAFT_INPUT_STYLE } from './types';

type TextColumnRenderers = Pick<
  Record<import('@/shared/types').InvoiceColumnId, InvoiceColumnRenderer>,
  'counterparty' | 'purpose' | 'contract_no' | 'invoice_no' | 'comment'
>;

/** Рендереры текстовых колонок и полей черновика (контрагент, назначение, договор, счёт, комментарий). */
export function createTextColumnRenderers(
  params: Pick<
    GroupedInvoiceTableColumnRenderersParams,
    'draftForm' | 'draftErrors' | 'counterpartyResults' | 'handleDraftChange' | 'handleDraftKeyDown'
  >,
): TextColumnRenderers {
  const { draftForm, draftErrors, counterpartyResults, handleDraftChange, handleDraftKeyDown } =
    params;

  return {
    counterparty: {
      width: 180,
      header: 'Контрагент',
      renderCell: () => null,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <Autocomplete
            size="xs"
            value={draftForm?.counterparty ?? ''}
            onChange={(v) => handleDraftChange('counterparty', v)}
            onKeyDown={handleDraftKeyDown}
            data={counterpartyResults || []}
            placeholder="Контрагент"
            error={draftErrors.counterparty}
          />
        </div>
      ),
    },
    purpose: {
      width: 200,
      header: 'Назначение платежа',
      renderCell: (invoice: IInvoice) => <>{invoice.purpose}</>,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <TextInput
            size="xs"
            value={draftForm?.purpose ?? ''}
            onChange={(e) => handleDraftChange('purpose', e.currentTarget.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Назначение"
            error={draftErrors.purpose}
          />
        </div>
      ),
    },
    contract_no: {
      width: 150,
      header: 'Договор',
      renderCell: (invoice: IInvoice) => <>{invoice.contract_no || '—'}</>,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <TextInput
            size="xs"
            value={draftForm?.contract_no ?? ''}
            onChange={(e) => handleDraftChange('contract_no', e.currentTarget.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Договор"
          />
        </div>
      ),
    },
    invoice_no: {
      width: 120,
      header: 'Счет',
      renderCell: (invoice: IInvoice) => <>{invoice.invoice_no}</>,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <TextInput
            size="xs"
            value={draftForm?.invoice_no ?? ''}
            onChange={(e) => handleDraftChange('invoice_no', e.currentTarget.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Счет"
            error={draftErrors.invoice_no}
          />
        </div>
      ),
    },
    comment: {
      width: 180,
      header: 'Комментарий',
      renderCell: (invoice: IInvoice) => <>{invoice.comment || '—'}</>,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <TextInput
            size="xs"
            value={draftForm?.comment ?? ''}
            onChange={(e) => handleDraftChange('comment', e.currentTarget.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Комментарий"
          />
        </div>
      ),
    },
  };
}
