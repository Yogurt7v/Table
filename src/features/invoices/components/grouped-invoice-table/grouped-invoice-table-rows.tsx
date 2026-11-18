import type { CSSProperties, ReactNode } from 'react';
import { ActionIcon, Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconGripVertical, IconX } from '@tabler/icons-react';

import type { IInvoice, InvoiceColumnId, IPaymentMark } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { markRowColor } from '@/features/invoices/payment-mark-row-style';
import type { InvoiceColumnRenderer } from './column-renderers/types';

const GROUP_BORDER = '3.5px solid var(--org-color, var(--mantine-primary-color-filled))';

/** Считает количество отображаемых строк для счёта с учётом копий оплат и остатка. */
export function getExpandedInvoiceRowCount(invoice: IInvoice): number {
  const amounts = invoice.payment_amounts ?? [];
  const totalPaid = amounts.reduce((sum, amount) => sum + amount, 0);
  let extra = 0;
  if (amounts.length > 1) extra += amounts.length - 1;
  if (totalPaid > 0 && invoice.amount - totalPaid > 0) extra += 1;
  return 1 + extra;
}

interface BuildInvoiceRowsParams {
  invoice: IInvoice;
  invoiceIndex: number;
  groupInvoices: IInvoice[];
  groupCounterparty: string;
  counterpartyRowIndex: number;
  invoiceNumber: number;
  filteredColumns: InvoiceColumnId[];
  columnRenderers: Record<InvoiceColumnId, InvoiceColumnRenderer>;
  columnSizing: Record<string, number>;
  mark?: IPaymentMark;
  isHighlighted: boolean;
  draggable: boolean;
  listeners?: Record<string, unknown>;
  isOver?: boolean;
  setClearConfirmInvoiceId: (id: string) => void;
}

/**
 * Строит строки таблицы для одного счёта: основная строка, копии частичных оплат
 * и строка остатка (если есть). Используется в sortable и non-sortable ветках.
 */
export function buildInvoiceRows({
  invoice,
  invoiceIndex,
  groupInvoices,
  groupCounterparty,
  counterpartyRowIndex,
  invoiceNumber,
  filteredColumns,
  columnRenderers,
  columnSizing,
  mark,
  isHighlighted,
  draggable,
  listeners,
  isOver = false,
  setClearConfirmInvoiceId,
}: BuildInvoiceRowsParams): ReactNode[] {
  const precedingRows = groupInvoices
    .slice(0, invoiceIndex)
    .reduce((sum, inv) => sum + getExpandedInvoiceRowCount(inv), 0);
  const followingRows = groupInvoices
    .slice(invoiceIndex + 1)
    .reduce((sum, inv) => sum + getExpandedInvoiceRowCount(inv), 0);
  const isGroupFirst = precedingRows === 0;
  const isGroupLast = followingRows === 0;

  const showCounterparty = invoiceIndex === counterpartyRowIndex - 1;
  const paid = invoice.paid;
  const amounts = invoice.payment_amounts ?? [];
  const totalPaid = amounts.reduce((sum, amount) => sum + amount, 0);
  const remaining = invoice.amount - totalPaid;
  const hasCopies = amounts.length > 1;
  const hasRemainder = !paid && totalPaid > 0 && remaining > 0;
  const extraRows = (hasCopies ? amounts.length - 1 : 0) + (hasRemainder ? 1 : 0);
  const isLastRow = isGroupLast && extraRows === 0;

  const baseBackground = paid
    ? 'var(--mantine-color-green-1)'
    : mark
      ? markRowColor(mark, invoice.amount)
      : isHighlighted
        ? { backgroundColor: 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)' }
        : undefined;
  const activeHighlightStyle: CSSProperties | undefined = isHighlighted
    ? {
        boxShadow:
          'inset 4px 0 0 var(--org-color, #228be6), inset 0 0 0 2px color-mix(in srgb, var(--org-color, #228be6) 45%, transparent)',
      }
    : undefined;

  const rowStyle: CSSProperties = {
    borderLeft: GROUP_BORDER,
    borderRight: GROUP_BORDER,
    ...(isGroupFirst ? { borderTop: GROUP_BORDER } : {}),
    ...(isLastRow ? { borderBottom: GROUP_BORDER } : {}),
    ...(typeof baseBackground === 'string'
      ? { backgroundColor: baseBackground }
      : baseBackground ?? {}),
    ...activeHighlightStyle,
    ...(draggable && isOver && isGroupFirst
      ? { borderTop: '3px solid var(--mantine-color-blue-6)' }
      : {}),
  };

  const rows: ReactNode[] = [];
  const dragListeners = draggable ? listeners : undefined;
  const isNumHandle = draggable;
  const isCpHandle = draggable && showCounterparty;

  // 1. Основная строка счёта
  rows.push(
    <Table.Tr
      key={invoice.id}
      style={rowStyle}
      data-highlight-id={isHighlighted ? invoice.id : undefined}
    >
      <Table.Td
        {...(isNumHandle ? (dragListeners as Record<string, unknown>) : {})}
        style={{
          cursor: isNumHandle ? 'grab' : undefined,
          overflow: 'hidden',
          maxWidth: '100%',
        }}
      >
        <div
          style={{
            overflow: 'hidden',
            maxWidth: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {draggable && (
            <IconGripVertical
              size={12}
              className="row-grip-icon"
              style={{ flexShrink: 0, color: 'var(--mantine-color-gray-5)' }}
            />
          )}
          {invoiceNumber})
        </div>
      </Table.Td>
      {filteredColumns.map((colId) => {
        const col = columnRenderers[colId];
        const width = columnSizing[colId] ?? col.width;
        const isThisCpHandle = isCpHandle && colId === 'counterparty';
        return (
          <Table.Td
            key={colId}
            {...(isThisCpHandle ? (dragListeners as Record<string, unknown>) : {})}
            style={{
              width,
              cursor: isThisCpHandle ? 'grab' : undefined,
            }}
          >
            <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
              {colId === 'counterparty' && showCounterparty ? (
                <>
                  <Text fw={600}>{groupCounterparty}</Text>
                  {groupInvoices.length > 1 && (
                    <Text size="xs" c="dimmed">
                      Итого:{' '}
                      {formatAmountRub(
                        groupInvoices
                          .filter((inv) => !inv.paid)
                          .reduce((sum, inv) => sum + inv.amount, 0),
                      )}
                    </Text>
                  )}
                </>
              ) : colId === 'counterparty' ? null : (
                col.renderCell(invoice)
              )}
            </div>
          </Table.Td>
        );
      })}
    </Table.Tr>,
  );

  // 2. Строки копий для частичных оплат (payment_amounts[1..n])
  if (amounts.length > 1) {
    for (let i = 1; i < amounts.length; i++) {
      const copyAmt = amounts[i]!;
      const isLastCopy = i === amounts.length - 1;
      const copyId = `${invoice.id}__p${i - 1}`;
      const suffix = `__p${i - 1}`;
      rows.push(
        <Table.Tr
          key={copyId}
          style={{
            borderLeft: GROUP_BORDER,
            borderRight: GROUP_BORDER,
            ...(isGroupLast && !hasRemainder && i === amounts.length - 1
              ? { borderBottom: GROUP_BORDER }
              : {}),
            backgroundColor: 'var(--mantine-color-green-1)',
            fontSize: '0.9em',
            ...activeHighlightStyle,
          }}
        >
          <Table.Td
            style={{
              overflow: 'hidden',
              maxWidth: '100%',
              color: 'var(--mantine-color-dimmed)',
            }}
          >
            <div style={{ overflow: 'hidden', maxWidth: '100%' }} />
          </Table.Td>
          {filteredColumns.map((colId) => {
            const col = columnRenderers[colId];
            const width = columnSizing[colId] ?? col.width;
            return (
              <Table.Td key={colId} style={{ width }}>
                <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                  {colId === 'counterparty' ? null : colId === 'paid' ? (
                    draggable ? (
                      <Group gap={2} wrap="nowrap">
                        <Badge color="green" variant="light">
                          {formatAmountRub(copyAmt)}
                        </Badge>
                        {isLastCopy && (
                          <Tooltip label="Снять оплату">
                            <ActionIcon
                              size="md"
                              color="red"
                              variant="subtle"
                              aria-label="Снять оплату"
                              onClick={() => setClearConfirmInvoiceId(copyId)}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    ) : (
                      <Badge color="green" variant="light">
                        {formatAmountRub(copyAmt)}
                      </Badge>
                    )
                  ) : colId === 'purpose' ? (
                    <Text size="xs" c="dimmed" fs="italic">
                      {invoice.purpose}
                    </Text>
                  ) : (
                    col.renderCell({
                      ...invoice,
                      id: copyId,
                      comment: invoice.copy_comments?.[suffix] ?? invoice.comment,
                      amount: copyAmt,
                      paid: true,
                      paid_amount: null,
                      payment_amounts: [],
                      paid_date: invoice.paid_date,
                    })
                  )}
                </div>
              </Table.Td>
            );
          })}
        </Table.Tr>,
      );
    }
  }

  // 3. Строка остатка по счёту
  if (hasRemainder) {
    const remainderId = `${invoice.id}__r`;
    const remainderInvoice: IInvoice = {
      ...invoice,
      id: remainderId,
      amount: remaining,
      paid: false,
      paid_amount: null,
      payment_amounts: [],
      paid_date: null as unknown as string,
    };
    rows.push(
      <Table.Tr
        key={remainderId}
        style={{
          borderLeft: GROUP_BORDER,
          borderRight: GROUP_BORDER,
          ...(isGroupLast ? { borderBottom: GROUP_BORDER } : {}),
          backgroundColor: 'var(--mantine-color-gray-0)',
          fontSize: '0.9em',
          ...activeHighlightStyle,
        }}
      >
        <Table.Td style={{ overflow: 'hidden', maxWidth: '100%' }}>
          <div
            style={{
              overflow: 'hidden',
              maxWidth: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <IconGripVertical
              size={12}
              className="row-grip-icon"
              style={{ flexShrink: 0, color: 'var(--mantine-color-gray-5)' }}
            />
            {invoiceNumber})
          </div>
        </Table.Td>
        {filteredColumns.map((colId) => {
          const col = columnRenderers[colId];
          const width = columnSizing[colId] ?? col.width;
          return (
            <Table.Td key={colId} style={{ width }}>
              <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                {colId === 'counterparty' ? null : colId === 'amount' ? (
                  <Text size="xs">
                    <Text component="span" fw={700}>
                      Остаток:
                    </Text>{' '}
                    {formatAmountRub(remaining)}
                  </Text>
                ) : colId === 'purpose' ? (
                  <Text size="xs" c="dimmed" fs="italic">
                    {invoice.purpose}
                  </Text>
                ) : (
                  col.renderCell({
                    ...remainderInvoice,
                    comment: invoice.copy_comments?.['__r'] ?? invoice.comment,
                  })
                )}
              </div>
            </Table.Td>
          );
        })}
      </Table.Tr>,
    );
  }

  // Итог: основная строка + копии частичных оплат + строка остатка (если есть)
  return rows;
}
