import dayjs from 'dayjs';
import type { DocumentHistoryChange, DocumentHistoryPayloadV2, IDocument } from '@/shared/types';
import {
  DOCUMENT_FIELD_LABELS,
  HIDDEN_FIELDS,
  HISTORY_TRIGGER_LABELS,
} from './document-card-modal-constants';
import type { DocumentForm } from './document-card-modal-types';

/** Пустая копия реквизитов документа — состояние формы редактирования по умолчанию. */
export function emptyForm(document: IDocument): DocumentForm {
  return {
    accounting_object_id: document.accounting_object_id,
    payment_date: document.payment_date,
    counterparty: document.counterparty,
    purpose: document.purpose,
    contract_no: document.contract_no,
    invoice_no: document.invoice_no,
    amount: document.amount,
    responsible_id: document.responsible_id,
  };
}

function isHistoryV2(data: Record<string, unknown>): data is DocumentHistoryPayloadV2 {
  return data['v'] === 2 && Array.isArray(data['changes']) && typeof data['meta'] === 'object';
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY') : value;
}

function formatDocumentHistoryValue(key: string, value: unknown, label?: string): string {
  if (label) return label;
  if (value == null || value === '') return '—';
  if (key === 'amount') {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('ru-RU') + ' ₽' : String(value);
  }
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  if (key === 'payment_date' || key === 'deleted_at') return formatDate(value);
  if (key === 'trigger' && typeof value === 'string') return HISTORY_TRIGGER_LABELS[value] ?? value;
  return String(value);
}

function formatChange(change: DocumentHistoryChange): string {
  const label = DOCUMENT_FIELD_LABELS[change.field] ?? change.field;
  const from = formatDocumentHistoryValue(change.field, change.from, change.from_label);
  const to = formatDocumentHistoryValue(change.field, change.to, change.to_label);
  if (change.from === undefined) return `${label}: ${to}`;
  if (change.to === undefined) return `${label}: ${from}`;
  return `${label}: ${from} → ${to}`;
}

function formatMeta(meta: Record<string, unknown>, type?: string): string[] {
  const lines: string[] = [];
  const reason = meta['reason'];
  if (typeof reason === 'string' && reason) lines.push(`Причина: ${reason}`);

  const trigger = meta['trigger'];
  if (typeof trigger === 'string' && trigger) {
    lines.push(`Триггер: ${HISTORY_TRIGGER_LABELS[trigger] ?? trigger}`);
  }

  const sourceInvoiceNo = meta['source_invoice_no'];
  if (typeof sourceInvoiceNo === 'string' && sourceInvoiceNo) {
    lines.push(`Счёт-источник: ${sourceInvoiceNo}`);
  }

  if (type === 'document_synced' && meta['sync_locked_set'] === true) {
    lines.push('Синхронизация со счётом: отключена');
  }

  const comment = meta['comment'];
  if (comment && typeof comment === 'object') {
    const c = comment as Record<string, unknown>;
    const author = c['author_name'];
    if (typeof author === 'string' && author) lines.push(`Автор комментария: ${author}`);
    const text = c['text'];
    if (typeof text === 'string' && text) lines.push(`Комментарий: «${text}»`);
  }

  const file = meta['file'];
  if (file && typeof file === 'object') {
    const f = file as Record<string, unknown>;
    const name = f['name'];
    if (typeof name === 'string' && name) lines.push(`Файл: «${name}»`);
  }

  return lines;
}

function formatLegacyDetails(data: Record<string, unknown>, type?: string): string {
  const lines: string[] = [];
  if ((type === 'file_added' || type === 'file_removed') && data['name']) {
    lines.push(`Файл «${String(data['name'])}»`);
    return lines.join('\n');
  }
  for (const [key, value] of Object.entries(data)) {
    if (HIDDEN_FIELDS.has(key) || key === 'automatic') continue;
    const label = DOCUMENT_FIELD_LABELS[key] ?? key;
    lines.push(`${label}: ${formatDocumentHistoryValue(key, value)}`);
  }
  return lines.join('\n');
}

/** Текст деталей события истории: v2 changes/meta с fallback для старых записей. */
export function historyDetails(data: Record<string, unknown>, type?: string): string {
  if (!data || Object.keys(data).length === 0) return '';

  if (isHistoryV2(data)) {
    const lines: string[] = [];
    lines.push(...formatMeta(data.meta, type));
    for (const change of data.changes) {
      lines.push(formatChange(change));
    }
    return lines.join('\n');
  }

  return formatLegacyDetails(data, type);
}
