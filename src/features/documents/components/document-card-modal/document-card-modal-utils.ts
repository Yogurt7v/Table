import type { IDocument } from '@/shared/types';
import { DOCUMENT_FIELD_LABELS, HIDDEN_FIELDS } from './document-card-modal-constants';
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

/** Человекочитаемое значение поля истории: сумма с рублями, флаги — «да»/«нет». */
function formatDocumentHistoryValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (key === 'amount') {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('ru-RU') + ' ₽' : String(value);
  }
  if (key === 'provided') return value === true ? 'да' : 'нет';
  if (key === 'confirmed') return value === true ? 'да' : 'нет';
  if (key === 'payment_cancelled') return value === true ? 'да' : 'нет';
  if (key === 'payment_resumed') return value === true ? 'да' : 'нет';
  return String(value);
}

/** Текст деталей события истории: список «поле: значение», без служебных полей. */
export function historyDetails(data: Record<string, unknown>, type?: string): string {
  if (!data || Object.keys(data).length === 0) return '';
  const lines: string[] = [];
  if (data['automatic'] === true) {
    lines.push('Документ создан автоматически');
  }
  // События файлов: показываем просто имя файла вместо сырых полей.
  if ((type === 'file_added' || type === 'file_removed') && data['name']) {
    lines.push(`Файл «${String(data['name'])}»`);
    return lines.join('\n');
  }
  for (const [key, value] of Object.entries(data)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    const label = DOCUMENT_FIELD_LABELS[key] ?? key;
    lines.push(`${label}: ${formatDocumentHistoryValue(key, value)}`);
  }
  return lines.join('\n');
}
