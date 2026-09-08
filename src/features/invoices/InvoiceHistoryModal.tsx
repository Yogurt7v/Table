import { useEffect } from 'react';
import { Modal, Text, Loader, Paper, Group, Badge, Divider } from '@mantine/core';
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

const HIDDEN_FIELDS = new Set(['payment_amounts', 'paid_amount']);

interface HistoryDiff {
  key: string;
  from: unknown;
  to: unknown;
}

type MarkEventKind = 'created' | 'deleted';

interface MarkEvent {
  kind: MarkEventKind;
  status: PaymentMarkStatus | null;
  amount: number | null;
  comment: string;
}

interface CopyEvent {
  amount: number | null;
  sourcePaidAmount: number | null;
  sourceId: string | null;
}

interface HistoryEntryDiffs {
  entryId: string;
  changedAt: string;
  author: string;
  isCopy: boolean;
  diffs: HistoryDiff[];
  paymentDiff: { from: boolean; to: boolean; amount: number | null; date: string | null } | null;
  markEvent: MarkEvent | null;
  copyEvent: CopyEvent | null;
}

interface InvoiceHistoryModalProps {
  invoiceId: string | null;
  invoiceLabel: string;
  opened: boolean;
  onClose: () => void;
}

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
          <Text size="xs" c="dimmed" mb="sm">
            Старые значения зачёркнуты
          </Text>
          {entries.map((item) => (
            <Paper key={item.entryId} p="sm" mb="xs" withBorder radius="sm">
              <Group justify="space-between" mb={4}>
                <Text size="xs" fw={600}>
                  {dayjs(item.changedAt).format('DD.MM.YYYY HH:mm:ss')}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.author}
                </Text>
              </Group>
              <Divider mb={6} />
              <Group gap={4} wrap="wrap">
                {item.isCopy && (
                  <Badge size="xs" variant="light" color="gray">
                    копия
                  </Badge>
                )}
                {item.copyEvent && <CopyEventBadge event={item.copyEvent} />}
                {item.markEvent && <MarkEventBadge event={item.markEvent} />}
                {item.paymentDiff && (
                  <PaymentBadge diff={item.paymentDiff} />
                )}
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

    const nextPrev =
      i < sorted.length - 1
        ? parsePreviousData(sorted[i + 1]!.previous_data)
        : null;

    const diffs: HistoryDiff[] = [];
    let paymentDiff: HistoryEntryDiffs['paymentDiff'] = null;

    if (entry.type === 'mark_created' || entry.type === 'mark_deleted') {
      const status = (prev['status'] as PaymentMarkStatus | undefined) ?? null;
      const amount =
        typeof prev['amount'] === 'number' ? prev['amount'] : Number(prev['amount'] ?? 0) || null;
      const comment = typeof prev['comment'] === 'string' ? prev['comment'] : '';
      const markEvent: HistoryEntryDiffs['markEvent'] = {
        kind: entry.type === 'mark_created' ? 'created' : 'deleted',
        status,
        amount: typeof amount === 'number' && !Number.isNaN(amount) ? amount : null,
        comment,
      };
      results.push({
        entryId: entry.id,
        changedAt: entry.changed_at,
        author: entry.author,
        isCopy,
        diffs,
        paymentDiff,
        markEvent,
        copyEvent: null,
      });
      continue;
    }

    if (entry.type === 'copy_created') {
      const copyEvent: CopyEvent = {
        amount: typeof prev['amount'] === 'number' ? prev['amount'] : Number(prev['amount'] ?? 0) || null,
        sourcePaidAmount:
          typeof prev['source_paid_amount'] === 'number' ? prev['source_paid_amount'] : null,
        sourceId: typeof prev['original_invoice_id'] === 'string' ? prev['original_invoice_id'] : null,
      };
      results.push({
        entryId: entry.id,
        changedAt: entry.changed_at,
        author: entry.author,
        isCopy,
        diffs,
        paymentDiff: null,
        markEvent: null,
        copyEvent,
      });
      continue;
    }


    const paidFrom = prev['paid'];
    const paidDateFrom = prev['paid_date'];
    const amountsFrom = Array.isArray(prev['payment_amounts'])
      ? (prev['payment_amounts'] as unknown[]).map(Number).filter((n) => !Number.isNaN(n))
      : [];
    const totalFrom = amountsFrom.reduce((s, n) => s + n, 0);

    let paidTo: unknown = null;

    if (i < sorted.length - 1 && nextPrev) {
      paidTo = nextPrev['paid'] ?? null;
    } else if (currentInvoice) {
      paidTo = currentInvoice.paid;
    }

    if (paidFrom != null) {
      paymentDiff = {
        from: Boolean(paidFrom),
        to: Boolean(paidTo),
        amount: totalFrom || null,
        date: paidDateFrom && typeof paidDateFrom === 'string' ? paidDateFrom : null,
      };
    }

    for (const [key, value] of Object.entries(prev)) {
      if (HIDDEN_FIELDS.has(key)) continue;
      if (key === 'paid' || key === 'paid_date') continue;

      let toValue: unknown = null;
      if (i < sorted.length - 1 && nextPrev && key in nextPrev) {
        toValue = nextPrev[key];
      } else if (currentInvoice && key in currentInvoice) {
        toValue = (currentInvoice as Record<string, unknown>)[key];
      }

      diffs.push({ key, from: value, to: toValue });
    }

    if (paymentDiff || diffs.length > 0) {
      results.push({
        entryId: entry.id,
        changedAt: entry.changed_at,
        author: entry.author,
        isCopy,
        diffs,
        paymentDiff,
        markEvent: null,
        copyEvent: null,
      });
    }
  }

  return results.reverse();
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

function PaymentBadge({ diff }: { diff: HistoryEntryDiffs['paymentDiff'] & {} }) {
  if (diff.from && !diff.to) {
    return (
      <Badge variant="light" color="red" size="sm">
        <Text component="span" td="line-through">
          Оплачено{diff.amount ? ` · ${formatAmountRub(diff.amount)}` : ''}
          {diff.date ? ` · ${dayjs(diff.date).format('DD.MM.YYYY')}` : ''}
        </Text>
      </Badge>
    );
  }

  if (!diff.from && diff.to) {
    return (
      <Badge variant="light" color="teal" size="sm">
        <Text component="span" td="line-through" c="dimmed">
          Не оплачено
        </Text>
        {' → '}
        <Text component="span">Оплачено</Text>
      </Badge>
    );
  }

  if (diff.from && diff.to) {
    return (
      <Badge variant="light" color="teal" size="sm">
        Оплачено
      </Badge>
    );
  }

  return null;
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

function CopyEventBadge({ event }: { event: CopyEvent }) {
  const amountText = event.amount ? ` · остаток ${formatAmountRub(event.amount)}` : '';
  const paidText = event.sourcePaidAmount
    ? ` · из частичной оплаты ${formatAmountRub(event.sourcePaidAmount)}`
    : '';
  return (
    <Badge variant="light" color="gray" size="sm">
      Создана копия{amountText}{paidText}
    </Badge>
  );
}

function MarkEventBadge({ event }: { event: MarkEvent }) {
  const statusText = markStatusLabel(event.status);
  const amountText = event.amount ? ` · ${formatAmountRub(event.amount)}` : '';
  const commentText = event.comment ? ` · ${event.comment}` : '';

  if (event.kind === 'deleted') {
    return (
      <Badge variant="light" color="red" size="sm">
        <Text component="span" td="line-through" c="dimmed">
          {statusText}:{amountText} - отменена
        </Text>
        {commentText && <Text component="span"> {commentText}</Text>}
      </Badge>
    );
  }

  return (
    <Badge variant="light" color="violet" size="sm">
      {statusText}{amountText}{commentText}
    </Badge>
  );
}
