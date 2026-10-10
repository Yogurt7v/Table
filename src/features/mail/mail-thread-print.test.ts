import { describe, it, expect } from 'vitest';
import {
  buildThreadPrintLetters,
  countPrintFiles,
  groupPrintFilesByLetter,
  mailPrintFileKind,
  mailPrintFileUrl,
  printLetterHeading,
  printSelectionLabel,
} from './mail-thread-print';
import type { ThreadLineNode } from './mail-thread-builder';
import type { MailLetter } from './mail-thread';
import type { IMailFile, MailType } from '@/shared/types';

/**
 * Печать вложений держится на чистом модуле: линия писем приходит из
 * конструктора готовой, а проверять её поведение рендером нечем — печать
 * уходит в `window.print()`, мимо рендера. Проверяется ровно то, что дорого
 * стоит: физический файл внутри пакетной записи адресуется отдельно, линия
 * печатается в том же порядке, а тип файла не выдумывается.
 */

const letter = (overrides: Partial<MailLetter> = {}): MailLetter => ({
  key: 'incoming:mail1',
  date: '2026-10-07',
  seq: 1,
  number: 'ВХ-44',
  counterparty: 'ООО «Ромашка»',
  subject: 'Счёт',
  ...overrides,
});

const node = (overrides: Partial<ThreadLineNode> = {}): ThreadLineNode => ({
  key: 'incoming:mail1',
  type: 'incoming',
  id: 'mail1',
  depth: 0,
  parentKey: null,
  letter: letter(),
  index: 0,
  ...overrides,
});

const file = (overrides: Partial<IMailFile> = {}): IMailFile => ({
  id: 'file1',
  mail_id: 'mail1',
  mail_type: 'incoming' as MailType,
  organization_id: 'org1',
  file: ['stored1.pdf'],
  name: 'Договор.pdf',
  ...overrides,
});

describe('mailPrintFileKind: чем браузер сможет напечатать содержимое', () => {
  it('PDF и картинки печатаются содержимым', () => {
    expect(mailPrintFileKind('stored.pdf')).toBe('pdf');
    expect(mailPrintFileKind('stored.PNG')).toBe('image');
    expect(mailPrintFileKind('stored.jpeg')).toBe('image');
  });

  it('всё остальное — только названием', () => {
    expect(mailPrintFileKind('stored.docx')).toBe('other');
    expect(mailPrintFileKind('stored.xlsx')).toBe('other');
    expect(mailPrintFileKind('stored')).toBe('other');
  });

  it('без расширения в хранилище тип берётся из исходного имени', () => {
    expect(mailPrintFileKind('stored', 'Счёт.pdf')).toBe('pdf');
    expect(mailPrintFileKind('stored', 'Фото.jpeg')).toBe('image');
  });
});

describe('mailPrintFileUrl: ссылка на выбранный файл, а не на первый в записи', () => {
  it('адрес содержит коллекцию, запись и имя самого файла', () => {
    const url = mailPrintFileUrl(file({ id: 'file9' }), 'third_of_batch.pdf');
    expect(url).toContain('/api/files/mail_files/file9/third_of_batch.pdf');
  });

  it('два файла одной записи дают разные ссылки', () => {
    const record = file({ file: ['one.pdf', 'two.pdf'] });
    expect(mailPrintFileUrl(record, 'one.pdf')).not.toBe(mailPrintFileUrl(record, 'two.pdf'));
  });
});

describe('buildThreadPrintLetters: единица печати — физический файл', () => {
  it('запись с десятью файлами даёт десять отдельных файлов', () => {
    const stored = Array.from({ length: 10 }, (_, i) => `stored${i}.pdf`);
    const letters = buildThreadPrintLetters(
      [node()],
      groupPrintFilesByLetter([file({ file: stored })]),
    );

    const files = letters[0]?.files ?? [];
    expect(files).toHaveLength(10);
    expect(files.map((item) => item.id)).toEqual(stored.map((_, i) => `file1#${i}`));
    expect(new Set(files.map((item) => item.url)).size).toBe(10);
  });

  it('у пакетной записи к исходному имени добавляется имя из хранилища', () => {
    const letters = buildThreadPrintLetters(
      [node()],
      groupPrintFilesByLetter([file({ file: ['a.png', 'b.png'], name: 'Скан.pdf' })]),
    );
    expect(letters[0]?.files.map((item) => item.displayName)).toEqual([
      'Скан.pdf · a.png',
      'Скан.pdf · b.png',
    ]);
  });

  it('у обычной записи остаётся исходное имя', () => {
    const letters = buildThreadPrintLetters([node()], groupPrintFilesByLetter([file()]));
    expect(letters[0]?.files[0]?.displayName).toBe('Договор.pdf');
  });

  it('запись без файла не даёт ни одного флажка', () => {
    const letters = buildThreadPrintLetters(
      [node()],
      groupPrintFilesByLetter([file({ file: [] })]),
    );
    expect(letters[0]?.files).toEqual([]);
  });
});

describe('buildThreadPrintLetters: печатается та же линия, что и показана', () => {
  const chain = [
    node({ key: 'incoming:a', id: 'a', depth: 0, index: 0 }),
    node({
      key: 'outgoing:b',
      type: 'outgoing',
      id: 'b',
      depth: 1,
      parentKey: 'incoming:a',
      index: 1,
    }),
    node({ key: 'incoming:c', id: 'c', depth: 2, parentKey: 'outgoing:b', index: 2 }),
  ];

  it('порядок, глубина и ключи письма сохраняются один в один', () => {
    const letters = buildThreadPrintLetters(chain, new Map());
    expect(letters.map((item) => item.key)).toEqual(['incoming:a', 'outgoing:b', 'incoming:c']);
    expect(letters.map((item) => item.depth)).toEqual([0, 1, 2]);
    expect(letters.map((item) => item.index)).toEqual([0, 1, 2]);
  });

  it('письмо без вложений остаётся в дереве', () => {
    const letters = buildThreadPrintLetters(chain, new Map());
    expect(letters).toHaveLength(3);
    expect(letters.every((item) => item.files.length === 0)).toBe(true);
  });

  it('вложения попадают к своему письму, чужие игнорируются', () => {
    const letters = buildThreadPrintLetters(
      chain,
      groupPrintFilesByLetter([
        file({ id: 'fb', mail_id: 'b', mail_type: 'outgoing' }),
        file({ id: 'foreign', mail_id: 'zzz' }),
      ]),
    );
    expect(letters[1]?.files.map((item) => item.id)).toEqual(['fb#0']);
    expect(countPrintFiles(letters)).toBe(1);
  });

  it('пустая линия не даёт ни одного письма', () => {
    expect(buildThreadPrintLetters([], new Map())).toEqual([]);
    expect(countPrintFiles([])).toBe(0);
  });
});

describe('groupPrintFilesByLetter: mail_id текстовый, регистр различает письма', () => {
  it('одно и то же id в разных регистрах — разные письма', () => {
    const grouped = groupPrintFilesByLetter([
      file({ id: 'in', mail_id: 'same', mail_type: 'incoming' }),
      file({ id: 'out', mail_id: 'same', mail_type: 'outgoing' }),
    ]);
    expect(grouped.get('incoming:same')?.map((item) => item.id)).toEqual(['in']);
    expect(grouped.get('outgoing:same')?.map((item) => item.id)).toEqual(['out']);
  });
});

describe('printLetterHeading: подпись письма в печатном документе', () => {
  it('собирает регистр, дату, номер и контрагента', () => {
    expect(printLetterHeading(node())).toBe('Входящее · 07.10.2026 · № ВХ-44 · ООО «Ромашка»');
  });

  it('исходящее письмо помечено своим регистром', () => {
    expect(
      printLetterHeading(
        node({ type: 'outgoing', letter: letter({ key: 'outgoing:b', number: '44/26' }) }),
      ),
    ).toBe('Исходящее · 07.10.2026 · № 44/26 · ООО «Ромашка»');
  });

  it('пустые номер и контрагент печатаются прочерком, а не пропадают', () => {
    expect(printLetterHeading(node({ letter: letter({ number: '', counterparty: '' }) }))).toBe(
      'Входящее · 07.10.2026 · № — · —',
    );
  });

  it('письмо без подписей называется вслух, а не молча', () => {
    expect(printLetterHeading(node({ letter: undefined }))).toBe(
      'Входящее · Письмо недоступно — связь ссылается на удалённое письмо',
    );
  });
});

describe('printSelectionLabel: сколько отмечено из скольких', () => {
  it('показывает оба числа', () => {
    expect(printSelectionLabel(3, 7)).toBe('Выбрано 3 из 7');
  });
});
