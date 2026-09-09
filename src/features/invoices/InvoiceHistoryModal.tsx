import { useEffect, type ReactNode } from 'react';
import {
  Modal,
  Text,
  Loader,
  Paper,
  Group,
  Badge,
  Divider,
  Box,
} from '@mantine/core';
import {
  IconCircleCheckFilled,
  IconX,
  IconCopy,
  IconPencil,
  IconFlag,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getInvoiceHistoryChain } from '@/api/collections';
import { formatAmountRub } from '@/shared/utils/format-currency';
import type { IInvoice, IInvoiceHistory, PaymentMarkStatus } from '@/shared/types';

const FIELD_LABELS: Record<string, string> = {
  counterparty: 'Контрагент',
  purpose: 'Назначение',
  contract_no: 'Договор',
  invoice_no: 'Номер счёта',
  amount: 'Сумма',
  comment: 'Комментарий',
};

const FIELD_COLORS: Record<string, string> = {
  amount: 'green',
  counterparty: 'blue',
  purpose: 'indigo',
  contract_no: 'violet',
  invoice_no: 'purple',
  comment: 'gray',
};

const HIDDEN_FIELDS = new Set([
  'payment_amounts',
  'paid_amount',
  'remaining',
  'removed_amount',
  'payment',
]);

interface HistoryDiff {
  key: string;
  from: unknown;
  to: unknown;
}

type ActionKind = 'payment' | 'payment_removed' | 'copy_created' | 'mark' | 'edit';

interface HistoryEntryDiffs {
  entryId: string;
  changedAt: string;
  author: string;
  isCopy: boolean;
  kind: ActionKind;
  actionText: string;
  actionColor: string;
  diffs: HistoryDiff[];
}

interface InvoiceHistoryModalProps {
  invoiceId: string | null;
  invoiceLabel: string;
  opened: boolean;
  onClose: () => void;
}

const ACTION_ICONS: Record<ActionKind, ReactNode> = {
  payment: <IconCircleCheckFilled size={16} />,
  payment_removed: <IconX size={16} />,
  copy_created: <IconCopy size={16} />,
  mark: <IconFlag size={16} />,
  edit: <IconPencil size={16} />,
};

export function InvoiceHistoryModal({
  invoiceId,
  invoiceLabel,
  opened,
  onClose,
}: InvoiceHistoryModalProps) {
  const { data: saga, isLoading: historyLoading, isError, error } = useQuery({
    queryKey: ['invoice_history', invoiceId],
    queryFn: () => getInvoiceHistoryChain(invoiceId!),
    enabled: opened && !!invoiceId,
  });

  const isLoading = historyLoading;

  useEffect(() => {
    if (isError && error) {
      console.error('[InvoiceHistoryModal]', error);
    }
  }, [isError, error]);

  const entries = saga
    ? saga.flatMap(({ invoice, history }) =>
        computeHistoryDiffs(history, invoice, !!invoice.original_invoice_id),
      )
    : [];
  entries.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

  const hasDiff = entries.some((e) => e.kind === 'edit' && e.diffs.length > 0);

  return (
    <Modal opened={opened} onClose={onClose} title={`История: ${invoiceLabel}`} size="lg">
      {isLoading && <Loader size="sm" />}

      {!isLoading && isError && (
        <Text c="red" size="sm">
          Не удалось загрузить историю: {error instanceof Error ? error.message : 'неизвестная ошибка'}
        </Text>
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <Text c="dimmed">Изменений пока нет</Text>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <>
          {hasDiff && (
            <Text size="xs" c="dimmed" mb="sm">
              Старые значения зачёркнуты
            </Text>
          )}
          {entries.map((item) => (
            <Paper key={item.entryId} p="sm" mb="xs" withBorder radius="sm">
              <Group justify="space-between" mb={4}>
                <Text size="xs" fw={600}>
                  {dayjs(item.changedAt).format('DD.MM.YYYY HH:mm')}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.author}
                </Text>
              </Group>
              <Divider mb={6} />
              <Group gap={8} wrap="wrap" align="center">
                <Box c={item.actionColor} style={{ display: 'flex' }}>
                  {ACTION_ICONS[item.kind]}
                </Box>
                {item.isCopy && (
                  <Badge size="xs" variant="light" color="gray">
                    копия
                  </Badge>
                )}
                <Badge
                  variant="light"
                  color={item.actionColor}
                  size="md"
                  styles={{ label: { whiteSpace: 'normal' } }}
                >
                  {item.actionText}
                </Badge>
              </Group>
              {item.diffs.length > 0 && (
                <Group gap={6} wrap="wrap" mt={6} ml={24}>
                  {item.diffs.map((diff) => (
                    <Badge
                      key={diff.key}
                      variant="light"
                      color={FIELD_COLORS[diff.key] ?? 'gray'}
                      size="sm"
                    >
                      {FIELD_LABELS[diff.key] ?? diff.key}:{' '}
                      <Text component="span" td="line-through" c="dimmed">
                        {formatHistoryValue(diff.key, diff.from)}
                      </Text>
                      {' → '}
                      <Text component="span">
                        {formatHistoryValue(diff.key, diff.to)}
                      </Text>
                    </Badge>
                  ))}
                </Group>
              )}
            </Paper>
          ))}
        </>
      )}
    </Modal>
  );
}

function computeHistoryDiffs(
  history: IInvoiceHistory[],
  currentInvoice: IInvoice | null,
  isCopy: boolean,
): HistoryEntryDiffs[] {
  if (history.length === 0) return [];

  const sorted = [...history].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
  );

  const results: HistoryEntryDiffs[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!;
    const prev =
      typeof entry.previous_data === 'string'
        ? (JSON.parse(entry.previous_data) as Record<string, unknown>)
        : entry.previous_data;

    if (entry.type === 'mark_created' || entry.type === 'mark_deleted') {
      results.push(buildMarkEntry(entry, prev, isCopy));
      continue;
    }

    if (entry.type === 'copy_created') {
      results.push(buildCopyEntry(entry, prev, isCopy));
      continue;
    }

    const paidFrom = prev['paid'];
    const paidDateFrom = prev['paid_date'];
    const amountsFrom = Array.isArray(prev['payment_amounts'])
      ? (prev['payment_amounts'] as unknown[]).map(Number).filter((n) => !Number.isNaN(n))
      : [];
    const totalFrom = amountsFrom.reduce((s, n) => s + n, 0);

    let paidTo: unknown = null;
    if (i < sorted.length - 1) {
      const nextPrev = parsePreviousData(sorted[i + 1]!.previous_data);
      paidTo = nextPrev?.['paid'] ?? null;
    } else if (currentInvoice) {
      paidTo = currentInvoice.paid;
    }

    const paidToBool = Boolean(paidTo);
    const paidFromBool = Boolean(paidFrom);

    if (paidFrom != null && paidFromBool !== paidToBool) {
      // Оплата или снятие оплаты — одна цельная карточка.
      const thisPayment =
        typeof prev['payment'] === 'number'
          ? prev['payment']
          : typeof prev['paid_amount'] === 'number'
            ? prev['paid_amount']
            : null;
      const remaining =
        typeof prev['remaining'] === 'number'
          ? prev['remaining']
          : currentInvoice
            ? (Number(currentInvoice.amount) || 0) - totalFrom - (thisPayment ?? 0)
            : null;

      if (!paidFromBool && paidToBool) {
        results.push({
          entryId: entry.id,
          changedAt: entry.changed_at,
          author: entry.author,
          isCopy,
          kind: 'payment',
          actionText:
            `Оплачено ${formatAmountRub(thisPayment ?? totalFrom)}` +
            (paidDateFrom && typeof paidDateFrom === 'string'
              ? ` · ${dayjs(paidDateFrom).format('DD.MM.YYYY')}`
              : '') +
            (remaining != null && remaining > 0 ? ` · остаток ${formatAmountRub(remaining)}` : ''),
          actionColor: 'teal',
          diffs: [],
        });
        continue;
      }

      if (paidFromBool && !paidToBool) {
        const removed =
          typeof prev['removed_amount'] === 'number'
            ? prev['removed_amount']
            : thisPayment ?? totalFrom;
        results.push({
          entryId: entry.id,
          changedAt: entry.changed_at,
          author: entry.author,
          isCopy,
          kind: 'payment_removed',
          actionText:
            `Снята оплата ${formatAmountRub(removed)}` +
            (remaining != null && remaining > 0 ? ` · остаток ${formatAmountRub(remaining)}` : ''),
          actionColor: 'red',
          diffs: [],
        });
        continue;
      }
    }

    // Обычное изменение полей счёта.
    const diffs: HistoryDiff[] = [];
    for (const [key, value] of Object.entries(prev)) {
      if (HIDDEN_FIELDS.has(key)) continue;

      let toValue: unknown = null;
      if (i < sorted.length - 1) {
        const nextPrev = parsePreviousData(sorted[i + 1]!.previous_data);
        if (nextPrev && key in nextPrev) {
          toValue = nextPrev[key];
        }
      } else if (currentInvoice && key in currentInvoice) {
        toValue = (currentInvoice as Record<string, unknown>)[key];
      }

      diffs.push({ key, from: value, to: toValue });
    }

    if (diffs.length > 0) {
      results.push({
        entryId: entry.id,
        changedAt: entry.changed_at,
        author: entry.author,
        isCopy,
        kind: 'edit',
        actionText: 'Изменены поля счёта',
        actionColor: 'gray',
        diffs,
      });
    }
  }

  return results.reverse();
}

function buildMarkEntry(
  entry: IInvoiceHistory,
  prev: Record<string, unknown>,
  isCopy: boolean,
): HistoryEntryDiffs {
  const status = (prev['status'] as PaymentMarkStatus | undefined) ?? null;
  const rawAmount = typeof prev['amount'] === 'number' ? prev['amount'] : (Number(prev['amount'] ?? 0) || null);
  const amount = typeof rawAmount === 'number' && !Number.isNaN(rawAmount) ? rawAmount : null;
  const comment = typeof prev['comment'] === 'string' ? prev['comment'] : '';

  const label = markStatusLabel(status);
  const amountText = amount != null ? ` ${formatAmountRub(amount)}` : '';
  const commentText = comment ? ` (${comment})` : '';

  const deleted = entry.type === 'mark_deleted';
  return {
    entryId: entry.id,
    changedAt: entry.changed_at,
    author: entry.author,
    isCopy,
    kind: 'mark',
    actionText: deleted
      ? `Отменена отметка «${label}${amountText}»${commentText}`
      : `Добавлена отметка «${label}${amountText}»${commentText}`,
    actionColor: deleted ? 'red' : 'violet',
    diffs: [],
  };
}

function buildCopyEntry(
  entry: IInvoiceHistory,
  prev: Record<string, unknown>,
  isCopy: boolean,
): HistoryEntryDiffs {
  const amount =
    typeof prev['amount'] === 'number' ? prev['amount'] : (Number(prev['amount'] ?? 0) || null);
  const sourcePaid =
    typeof prev['source_paid_amount'] === 'number' ? prev['source_paid_amount'] : null;

  const text =
    `Создана копия-остаток${amount != null ? ` ${formatAmountRub(amount)}` : ''}` +
    (sourcePaid != null && sourcePaid > 0
      ? ` (из частичной оплаты ${formatAmountRub(sourcePaid)})`
      : '');

  return {
    entryId: entry.id,
    changedAt: entry.changed_at,
    author: entry.author,
    isCopy,
    kind: 'copy_created',
    actionText: text,
    actionColor: 'gray',
    diffs: [],
  };
}

function parsePreviousData(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return data as Record<string, unknown>;
}

function formatHistoryValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (key === 'amount') return formatAmountRub(Number(value));
  return String(value);
}

const MARK_STATUS_LABELS: Record<PaymentMarkStatus, string> = {
  proposed: 'Согласование',
  approved: 'Оплатить',
  partial: 'Частично',
};

function markStatusLabel(status: PaymentMarkStatus | null): string {
  return status ? MARK_STATUS_LABELS[status] : 'Отметка';
}
