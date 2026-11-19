import dayjs from 'dayjs';
import { getInvoiceFileDownloadUrl } from '@/api/collections';
import { formatAmountRub } from '@/shared/utils/format-currency';
import type { IInvoice, IInvoiceHistory, PaymentMarkStatus } from '@/shared/types';
import { HIDDEN_FIELDS } from './invoice-history-modal-constants';
import type { HistoryDiff, HistoryEntryDiffs } from './invoice-history-modal-types';

/**
 * Разбор цепочки истории счёта в записи для показа.
 *
 * `previous_data` — снимок полей ДО изменения, а «после» берётся из следующей,
 * более свежей записи (или из текущего счёта для самой последней правки).
 * Особые типы (отметки, архив, копия, файлы, оплата) превращаются в цельные
 * карточки с готовым текстом, остальное — в список диффов полей.
 */
export function computeHistoryDiffs(
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
    const prev = parsePreviousData(entry.previous_data) ?? {};

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
            : (thisPayment ?? totalFrom);
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
        toValue = (currentInvoice as unknown as Record<string, unknown>)[key];
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

/** Карточка архивации: удаление или восстановление счёта. */
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

/** Карточка отметки к оплате: создание/снятие с текстом по статусу. */
function buildMarkEntry(
  entry: IInvoiceHistory,
  prev: Record<string, unknown>,
  isCopy: boolean,
): HistoryEntryDiffs {
  const status = (prev['status'] as PaymentMarkStatus | undefined) ?? null;
  const rawAmount =
    typeof prev['amount'] === 'number' ? prev['amount'] : Number(prev['amount'] ?? 0) || null;
  const amount = typeof rawAmount === 'number' && !Number.isNaN(rawAmount) ? rawAmount : null;
  const comment = typeof prev['comment'] === 'string' ? prev['comment'] : '';
  const amountText = amount != null ? ` ${formatAmountRub(amount)}` : '';
  const commentText = comment ? ` (${comment})` : '';

  const deleted = entry.type === 'mark_deleted';

  let actionText: string;
  if (status === 'approved') {
    actionText = deleted ? 'Утверждение оплаты отменено' : `Утверждена оплата${amountText}`;
  } else if (status === 'proposed') {
    actionText = deleted ? 'Запрос на согласование отменён' : `Запрос на согласование${amountText}`;
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

/** Карточка создания копии-остатка. */
function buildCopyEntry(
  entry: IInvoiceHistory,
  prev: Record<string, unknown>,
  isCopy: boolean,
): HistoryEntryDiffs {
  const amount =
    typeof prev['amount'] === 'number' ? prev['amount'] : Number(prev['amount'] ?? 0) || null;

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

/** Карточка файла: прикрепление или удаление, с ссылкой на скачивание. */
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
    kind: removed ? 'file_removed' : 'file_added',
    actionText: removed ? `Удалён файл «${fileName}»` : `Прикреплён файл «${fileName}»`,
    diffs: [],
    fileLink,
  };
}

/** Снимок `previous_data`: строка JSON или готовый объект; мусор — пустой снимок. */
export function parsePreviousData(data: unknown): Record<string, unknown> | null {
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

/** Значение поля для карточки правки: суммы — в рублях, пустое — прочерк. */
export function formatHistoryValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (key === 'amount') return formatAmountRub(Number(value));
  return String(value);
}
