import { NumberInput, Text } from '@mantine/core';
import { formatAmountNumber } from '@/shared/utils/format-currency';
import { getEffectiveAmount } from '@/shared/utils/invoice-utils';
import type { GroupedInvoiceTableColumnRenderersParams, InvoiceColumnRenderer } from './types';
import { DRAFT_INPUT_STYLE } from './types';

/** Рендерер колонки суммы и поля ввода суммы в черновике. */
export function createAmountColumnRenderer(
  params: Pick<
    GroupedInvoiceTableColumnRenderersParams,
    | 'draftForm'
    | 'draftErrors'
    | 'amountFocused'
    | 'amountDisplay'
    | 'handleDraftChange'
    | 'handleDraftKeyDown'
    | 'setAmountDisplay'
    | 'setAmountFocused'
    | 'setDraftErrors'
  >,
): InvoiceColumnRenderer {
  const {
    draftForm,
    draftErrors,
    amountFocused,
    amountDisplay,
    handleDraftChange,
    handleDraftKeyDown,
    setAmountDisplay,
    setAmountFocused,
    setDraftErrors,
  } = params;

  // Рендерер колонки «Сумма» (ячейка + поле черновика)
  return {
    width: 100,
    header: 'Сумма',
    renderCell: (invoice) => (
      <Text fw={400}>{formatAmountNumber(getEffectiveAmount(invoice))}</Text>
    ),
    renderDraft: () => (
      <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
        <NumberInput
          size="xs"
          value={
            amountFocused && draftForm?.amount === 0
              ? (undefined as unknown as number)
              : (draftForm?.amount ?? 0)
          }
          onChange={(v) => {
            setAmountDisplay(String(v ?? ''));
            handleDraftChange('amount', v ?? 0);
            setDraftErrors((prev) => {
              const next = { ...prev };
              delete next.amount;
              return next;
            });
          }}
          onKeyDown={handleDraftKeyDown}
          onFocus={() => {
            if (draftForm?.amount === 0) {
              setAmountFocused(true);
              setAmountDisplay('');
              setDraftErrors((prev) => {
                const next = { ...prev };
                delete next.amount;
                return next;
              });
            }
          }}
          onBlur={() => {
            setAmountFocused(false);
            if (amountDisplay.trim() === '') {
              setAmountDisplay('0');
              handleDraftChange('amount', 0);
            }
          }}
          thousandSeparator=" "
          decimalSeparator=","
          placeholder="Сумма"
          error={draftErrors.amount}
        />
      </div>
    ),
  };
}
