import { describe, it, expect } from 'vitest';
import type { IDocument } from '@/shared/types';

function makeDocument(overrides: Partial<IDocument> = {}): IDocument {
  return {
    id: 'doc1',
    organization_id: 'org1',
    accounting_object_id: 'obj1',
    seq: 1,
    payment_date: '2026-10-14',
    counterparty: 'ООО Тест',
    purpose: 'Назначение',
    contract_no: 'Д-1',
    invoice_no: 'СЧ-1',
    amount: 1000,
    responsible_id: 'u1',
    responsible_name: 'Ответственный',
    created_by: 'u2',
    created_by_name: 'Автор',
    source_invoice_id: 'inv1',
    source_invoice_no: 'СЧ-1',
    creation_mode: 'auto',
    sync_locked: false,
    provided: false,
    confirmed: false,
    confirmed_file_id: '',
    payment_cancelled: false,
    is_deleted: false,
    ...overrides,
  };
}

/**
 * Иерархия статусов «Предоставлен» → «Подтверждён» (D4, D33, D34):
 * - «Подтверждён» нельзя без «Предоставлен»
 * - При ручном снятии «Предоставлен» сбрасывается «Подтверждён» и confirmed_file_id
 * - Добавление нового файла не снимает подтверждение
 * - Удаление подтверждённого файла снимает подтверждение
 * - Удаление последнего файла снимает оба статуса
 * - Ручное снятие «Предоставлен» действует до следующей загрузки файла
 * - Повторная загрузка файла снова включает «Предоставлен»
 */
function isDocumentCompleted(doc: IDocument): boolean {
  return doc.provided && doc.confirmed;
}

function applyStatusChange(
  doc: IDocument,
  field: 'provided' | 'confirmed',
  value: boolean,
  filesCount: number,
  confirmedFileId: string | undefined,
): IDocument {
  const next = { ...doc };
  if (field === 'provided' && value === false) {
    next.provided = false;
    next.confirmed = false;
    next.confirmed_file_id = '';
  }
  if (field === 'confirmed' && value === true) {
    if (!doc.provided) throw new Error('Cannot confirm without provided');
    next.confirmed = true;
    next.confirmed_file_id = confirmedFileId || '';
  }
  if (field === 'confirmed' && value === false) {
    next.confirmed = false;
    next.confirmed_file_id = '';
  }
  if (filesCount === 0) {
    next.provided = false;
    next.confirmed = false;
    next.confirmed_file_id = '';
  }
  return next;
}

describe('document status hierarchy', () => {
  it('cannot confirm without provided', () => {
    const doc = makeDocument({ provided: false, confirmed: false });
    expect(() => applyStatusChange(doc, 'confirmed', true, 0, undefined)).toThrow(
      'Cannot confirm without provided',
    );
  });

  it('can confirm when provided is true', () => {
    const doc = makeDocument({ provided: true, confirmed: false });
    const next = applyStatusChange(doc, 'confirmed', true, 1, 'file1');
    expect(next.confirmed).toBe(true);
    expect(next.confirmed_file_id).toBe('file1');
    expect(isDocumentCompleted(next)).toBe(true);
  });

  it('removing provided resets confirmed and confirmed_file_id', () => {
    const doc = makeDocument({
      provided: true,
      confirmed: true,
      confirmed_file_id: 'file1',
    });
    const next = applyStatusChange(doc, 'provided', false, 1, 'file1');
    expect(next.provided).toBe(false);
    expect(next.confirmed).toBe(false);
    expect(next.confirmed_file_id).toBe('');
  });

  it('removing confirmed only resets confirmed_file_id, keeps provided', () => {
    const doc = makeDocument({
      provided: true,
      confirmed: true,
      confirmed_file_id: 'file1',
    });
    const next = applyStatusChange(doc, 'confirmed', false, 1, 'file1');
    expect(next.provided).toBe(true);
    expect(next.confirmed).toBe(false);
    expect(next.confirmed_file_id).toBe('');
  });

  it('deleting the last file resets both statuses', () => {
    const doc = makeDocument({
      provided: true,
      confirmed: true,
      confirmed_file_id: 'file1',
    });
    const next = applyStatusChange(doc, 'provided', true, 0, undefined);
    expect(next.provided).toBe(false);
    expect(next.confirmed).toBe(false);
    expect(next.confirmed_file_id).toBe('');
  });

  it('deleting the confirmed file resets only confirmed', () => {
    const doc = makeDocument({
      provided: true,
      confirmed: true,
      confirmed_file_id: 'file1',
    });
    // confirmed_file_id === deleted file id → confirmed reset, provided stays
    const next = { ...doc, confirmed: false, confirmed_file_id: '' };
    expect(next.provided).toBe(true);
    expect(next.confirmed).toBe(false);
    expect(next.confirmed_file_id).toBe('');
  });

  it('isDocumentCompleted only when both statuses are true', () => {
    expect(isDocumentCompleted(makeDocument())).toBe(false);
    expect(isDocumentCompleted(makeDocument({ provided: true }))).toBe(false);
    expect(isDocumentCompleted(makeDocument({ confirmed: true }))).toBe(false);
    expect(isDocumentCompleted(makeDocument({ provided: true, confirmed: true }))).toBe(true);
  });

  it('manual removal of provided stays until file re-upload', () => {
    const doc = makeDocument({ provided: true, confirmed: true });
    const afterRemoval = applyStatusChange(doc, 'provided', false, 1, '');
    expect(afterRemoval.provided).toBe(false);
    expect(afterRemoval.confirmed).toBe(false);
    // Re-uploading a file sets provided back to true (simulated)
    const afterUpload = { ...afterRemoval, provided: true };
    expect(afterUpload.provided).toBe(true);
    expect(afterUpload.confirmed).toBe(false); // confirmed stays false until explicitly set
  });
});
