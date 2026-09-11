import { useEffect, type ReactNode } from 'react';
import { Modal, Text, Loader, Group, Box, Anchor, Stack } from '@mantine/core';
import {
  IconCircleCheckFilled,
  IconX,
  IconCopy,
  IconPencil,
  IconFlag,
  IconPaperclip,
  IconTrash,
  IconRotate,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getInvoiceHistoryChain, getInvoiceFileDownloadUrl } from '@/api/collections';
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

const HIDDEN_FIELDS = new Set([
  'payment_amounts',
  'paid_amount',
  'remaining',
  'removed_amount',
  'payment',
  'paid',
  'paid_date',
]);

interface HistoryDiff {
  key: string;
  from: unknown;
  to: unknown;
}

type ActionKind =
  | 'payment'
  | 'payment_removed'
  | 'copy_created'
  | 'mark'
  | 'edit'
  | 'file_added'
  | 'file_removed'
  | 'invoice_deleted'
  | 'invoice_restored';

interface HistoryEntryDiffs {
  entryId: string;
  changedAt: string;
  author: string;
  isCopy: boolean;
  kind: ActionKind;
  actionText: string;
  diffs: HistoryDiff[];
  fileLink?: string;
}

interface InvoiceHistoryModalProps {
  invoiceId: string | null;
  invoiceLabel: string;
  opened: boolean;
  onClose: () => void;
}

const ACTION_ICONS: Record<ActionKind, ReactNode> = {
  payment: <IconCircleCheckFilled size={14} />,
  payment_removed: <IconX size={14} />,
  copy_created: <IconCopy size={14} />,
  mark: <IconFlag size={14} />,
  edit: <IconPencil size={14} />,
  file_added: <IconPaperclip size={14} />,
  file_removed: <IconPaperclip size={14} />,
  invoice_deleted: <IconTrash size={14} />,
  invoice_restored: <IconRotate size={14} />,
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
  const isCopyInvoice = saga?.[0]?.invoice?.original_invoice_id ? true : false;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`История: ${invoiceLabel}${isCopyInvoice ? ' · остаток' : ''}`}
      size="lg"
    >
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
          <Box ml={6}>
            {entries.map((item, index) => {
              const isLast = index === entries.length - 1;
              return (
                <Group key={item.entryId} gap={12} align="flex-start" wrap="nowrap">
                  <Stack align="center" gap={0} mt={2} style={{ width: 20, alignSelf: 'stretch' }}>
                    <Box
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: '1px solid var(--mantine-color-gray-3)',
                        background: 'var(--mantine-color-gray-0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--mantine-color-gray-6)',
                        flexShrink: 0,
                      }}
                    >
                      {ACTION_ICONS[item.kind]}
                    </Box>
                    {!isLast && (
                      <Box
                        style={{
                          width: 1,
                          flex: 1,
                          background: 'var(--mantine-color-gray-2)',
                          minHeight: 28,
                        }}
                      />
                    )}
                  </Stack>
                  <Box pb={isLast ? 0 : 18} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap" align="center">
                      {item.fileLink ? (
                        <Anchor
                          href={item.fileLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          c="dark.4"
                        >
                          {item.actionText}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dark.5" inline>
                          {item.actionText}
                        </Text>
                      )}
                    </Group>

                    {item.diffs.length > 0 && (
                      <Group gap={6} wrap="wrap" mt={4}>
                        {item.diffs.map((diff) => (
                          <Box
                            key={diff.key}
                            px={8}
                            py={3}
                            style={{
                              borderRadius: 6,
                              background: 'var(--mantine-color-gray-0)',
                              border: '1px solid var(--mantine-color-gray-2)',
                            }}
                          >
                            <Text component="span" size="xs" c="dimmed">
                              {FIELD_LABELS[diff.key] ?? diff.key}
                              {': '}
                            </Text>
                            <Text component="span" size="xs" td="line-through" c="dimmed">
                              {formatHistoryValue(diff.key, diff.from)}
                            </Text>
                            <Text component="span" size="xs" c="gray.5">
                              {' → '}
                            </Text>
                            <Text component="span" size="xs">
                              {formatHistoryValue(diff.key, diff.to)}
                            </Text>
                          </Box>
                        ))}
                      </Group>
                    )}

                    <Text size="xs" c="dimmed" mt={2}>
                      {dayjs(item.changedAt).format('DD.MM.YYYY HH:mm:ss')} ·{' '}
                      <Text component="span" c="dark.6">
                        {item.author}
                      </Text>
                    </Text>
                  </Box>
                </Group>
              );
            })}
          </Box>
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

    if (entry.type === 'invoice_deleted' || entry.type === 'invoice_restored') {
      results.push(buildArchiveEntry(entry, prev, isCopy));
      continue;
    }

    if (entry.type === 'copy_created') {
      results.push(buildCopyEntry(entry, prev, isCopy));
      continue;
    }

    if (entry.type === 'file_added' || entry.type === 'file_removed') {
      results.push(buildFileEntry(entry, prev, isCopy));
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
        diffs,
      });
    }
  }

  return results.reverse();
}

function buildArchiveEntry(
  entry: IInvoiceHistory,
  prev: Record<string, unknown>,
  isCopy: boolean,
): HistoryEntryDiffs {
  const deletedBy =
    typeof prev['deleted_by_name'] === 'string' && prev['deleted_by_name']
      ? prev['deleted_by_name']
      : '';
  const deletedAt =
    typeof prev['deleted_at'] === 'string' && prev['deleted_at']
      ? dayjs(prev['deleted_at']).format('DD.MM.YYYY HH:mm:ss')
      : '';

  const restored = entry.type === 'invoice_restored';
  const actionText = restored
    ? 'Счёт восстановлен из архива'
    : `Счёт удалён${deletedBy ? ` · ${deletedBy}` : ''}${deletedAt ? ` · ${deletedAt}` : ''}`;

  return {
    entryId: entry.id,
    changedAt: entry.changed_at,
    author: entry.author,
    isCopy,
    kind: restored ? 'invoice_restored' : 'invoice_deleted',
    actionText,
    diffs: [],
  };
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
  const amountText = amount != null ? ` ${formatAmountRub(amount)}` : '';
  const commentText = comment ? ` (${comment})` : '';

  const deleted = entry.type === 'mark_deleted';

  let actionText: string;
  if (status === 'approved') {
    actionText = deleted ? 'Утверждение оплаты отменено' : `Утверждена оплата${amountText}`;
  } else if (status === 'proposed') {
    actionText = deleted
      ? 'Запрос на согласование отменён'
      : `Запрос на согласование${amountText}`;
  } else {
    actionText = deleted
      ? 'Отметка частичной оплаты снята'
      : `Отмечена частичная оплата${amountText}`;
  }

  return {
    entryId: entry.id,
    changedAt: entry.changed_at,
    author: entry.author,
    isCopy,
    kind: 'mark',
    actionText: actionText + commentText,
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

  const text = `Создана копия-остаток${amount != null ? ` ${formatAmountRub(amount)}` : ''}`;

  return {
    entryId: entry.id,
    changedAt: entry.changed_at,
    author: entry.author,
    isCopy,
    kind: 'copy_created',
    actionText: text,
    diffs: [],
  };
}

function buildFileEntry(
  entry: IInvoiceHistory,
  prev: Record<string, unknown>,
  isCopy: boolean,
): HistoryEntryDiffs {
  const fileName = typeof prev['file_name'] === 'string' ? prev['file_name'] : 'файл';
  const removed = entry.type === 'file_removed';

  const fileId = typeof prev['file_id'] === 'string' ? prev['file_id'] : '';
  const fileKey = typeof prev['file'] === 'string' ? prev['file'] : '';
  const fileLink =
    fileId && fileKey ? getInvoiceFileDownloadUrl({ file_id: fileId, file: fileKey }) : undefined;

  return {
    entryId: entry.id,
    changedAt: entry.changed_at,
    author: entry.author,
    isCopy,
    kind: entry.type === 'file_removed' ? 'file_removed' : 'file_added',
    actionText: removed ? `Удалён файл «${fileName}»` : `Прикреплён файл «${fileName}»`,
    diffs: [],
    fileLink,
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
