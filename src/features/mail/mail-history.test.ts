import { describe, it, expect } from 'vitest';
import type { IIncomingMail, IMailHistory } from '@/shared/types';
import { snapshotForHistory } from './mail-form';
import { buildMailHistoryEntries } from './mail-history';

/**
 * Разбор `mail_history` в диффы. Проверяется round-trip, которым живёт экран:
 * снимок письма ДО правки (`snapshotForHistory`) кладётся в `previous_data`, а
 * «после» для самой свежей правки берётся из текущего письма — потому что
 * следующей записи, из которой его обычно читают, у неё нет.
 */

function historyEntry(
  entry: Pick<IMailHistory, 'id' | 'type' | 'changed_at'> & Partial<IMailHistory>,
): IMailHistory {
  return {
    organization_id: 'org1',
    author: 'user1',
    previous_data: {},
    ...entry,
  };
}

const before: IIncomingMail = {
  id: 'm1',
  organization_id: 'org1',
  accounting_object_id: 'obj1',
  number: 'ВХ-1',
  date: '2026-10-09 00:00:00.000Z',
  sender_outgoing_number: 'ИСХ-9',
  subject: 'Тема письма',
  sender: 'ООО «Ромашка»',
  responsible: 'user1',
  delivery_method: 'email',
  comment: '',
};

describe('mail-history: buildMailHistoryEntries', () => {
  it('добавленный комментарий даёт дифф «пусто → текст», а не пропадает', () => {
    const after = { ...before, comment: 'Позвонить в четверг' };

    const entries = buildMailHistoryEntries(
      [
        historyEntry({
          id: 'h1',
          type: 'updated',
          changed_at: '2026-10-09T12:00:00',
          previous_data: snapshotForHistory('incoming', before),
        }),
      ],
      after as unknown as Record<string, unknown>,
    );

    expect(entries[0]!.diffs).toEqual([{ key: 'comment', from: '', to: 'Позвонить в четверг' }]);
  });

  it('новая правка берёт «после» из текущего письма, а старая — из следующей записи', () => {
    const entries = buildMailHistoryEntries(
      [
        historyEntry({
          id: 'h1',
          type: 'updated',
          changed_at: '2026-10-09T11:00:00',
          previous_data: { comment: 'Первый' },
        }),
        historyEntry({
          id: 'h2',
          type: 'updated',
          changed_at: '2026-10-09T12:00:00',
          previous_data: { comment: 'Второй' },
        }),
      ],
      { comment: 'Третий' },
    );

    const older = entries.find((entry) => entry.entryId === 'h1')!;
    const newer = entries.find((entry) => entry.entryId === 'h2')!;

    expect(older.diffs).toEqual([{ key: 'comment', from: 'Первый', to: 'Второй' }]);
    expect(newer.diffs).toEqual([{ key: 'comment', from: 'Второй', to: 'Третий' }]);
  });

  it('неизменённые поля диффом не помечаются', () => {
    const after = { ...before, comment: 'Новый' };

    const entries = buildMailHistoryEntries(
      [
        historyEntry({
          id: 'h1',
          type: 'updated',
          changed_at: '2026-10-09T12:00:00',
          previous_data: snapshotForHistory('incoming', before),
        }),
      ],
      after as unknown as Record<string, unknown>,
    );

    expect(entries[0]!.diffs.map((diff) => diff.key)).toEqual(['comment']);
  });

  it('служебные поля PocketBase в диффы не попадают', () => {
    const entries = buildMailHistoryEntries(
      [
        historyEntry({
          id: 'h1',
          type: 'updated',
          changed_at: '2026-10-09T12:00:00',
          previous_data: {
            collectionId: 'pbc_1',
            collectionName: 'incoming_mails',
            organization_id: 'org1',
            comment: '',
          },
        }),
      ],
      { comment: 'Текст' },
    );

    expect(entries[0]!.diffs.map((diff) => diff.key)).toEqual(['comment']);
  });
});
