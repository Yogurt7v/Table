import { describe, it, expect } from 'vitest';
import {
  ALWAYS_ALLOWED_COLUMNS,
  CAPABILITIES,
  COLUMNS_BY_CAPABILITY,
  getAllowedColumns,
  getColumnSettingsItems,
  resolveVisibleColumns,
} from './mail-column-visibility';
import { COLUMNS_AT_LAYOUT_INTRO } from './mail-column-visibility';
import type { MailColumnSettingItem } from './mail-column-visibility';
import {
  ALL_MAIL_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  getMailColumnLabel,
  getOrderedColumns,
} from './mail-columns';
import type { MailColumnId } from './mail-columns';
import { NO_MAIL_PERMISSIONS } from './mail-field-access';
import type { MailPermissions } from './mail-field-access';

const withPermissions = (overrides: Partial<MailPermissions>): MailPermissions => ({
  ...NO_MAIL_PERMISSIONS,
  ...overrides,
});

const READ_ONLY = withPermissions({ canView: true });

/**
 * Ожидание по контракту `resolveVisibleColumns`: сохранённый список задаёт
 * порядок, а колонки, добавленные после того, как он был сохранён, встают на своё
 * каноническое место относительно сохранённых. Оба правила выведены из
 * `DEFAULT_VISIBLE_COLUMNS` и `COLUMNS_AT_LAYOUT_INTRO`, а не записаны списком —
 * иначе следующая новая колонка снова сломала бы эти проверки.
 */
const withColumnsAddedLater = (...saved: MailColumnId[]): MailColumnId[] => {
  const canonical = new Map(DEFAULT_VISIBLE_COLUMNS.map((id, index) => [id, index]));
  const result = [...saved];
  for (const id of DEFAULT_VISIBLE_COLUMNS) {
    if (result.includes(id) || COLUMNS_AT_LAYOUT_INTRO.includes(id)) continue;
    const at = result.findIndex(
      (existing) => (canonical.get(existing) ?? 0) > (canonical.get(id) ?? 0),
    );
    if (at === -1) result.push(id);
    else result.splice(at, 0, id);
  }
  return result;
};

const FULL = withPermissions({
  canView: true,
  canCreateIncoming: true,
  canEditIncoming: true,
  canDeleteIncoming: true,
  canCreateOutgoing: true,
  canEditOutgoing: true,
  canDeleteOutgoing: true,
  canManageFiles: true,
  canViewHistory: true,
  canRestore: true,
  canViewArchive: true,
});

describe('mail-column-visibility', () => {
  it('the capability table covers actions and files and nothing else', () => {
    expect(CAPABILITIES).toEqual(['actions', 'files']);
    expect(COLUMNS_BY_CAPABILITY.actions).toEqual(['actions']);
    expect(COLUMNS_BY_CAPABILITY.files).toEqual(['files']);
  });

  it('every declared column is either always allowed or gated by a capability', () => {
    const gated = CAPABILITIES.flatMap((capability) => COLUMNS_BY_CAPABILITY[capability]);
    expect([...ALWAYS_ALLOWED_COLUMNS, ...gated].sort()).toEqual(
      ALL_MAIL_COLUMNS.map((column) => column.id).sort(),
    );
    expect(ALWAYS_ALLOWED_COLUMNS).not.toContain('actions');
    expect(ALWAYS_ALLOWED_COLUMNS).not.toContain('files');
  });

  it('a read-only flag set hides actions and files', () => {
    const allowed = getAllowedColumns(READ_ONLY);
    expect(allowed).not.toContain('actions');
    expect(allowed).not.toContain('files');
    expect(allowed).toEqual(ALWAYS_ALLOWED_COLUMNS);
  });

  it('no permissions at all still allow the read-only columns', () => {
    expect(getAllowedColumns(NO_MAIL_PERMISSIONS)).toEqual(ALWAYS_ALLOWED_COLUMNS);
  });

  it('a full flag set shows every column', () => {
    expect(getAllowedColumns(FULL)).toEqual(ALL_MAIL_COLUMNS.map((column) => column.id));
  });

  it('any one edit or delete flag opens actions', () => {
    for (const flag of [
      'canEditIncoming',
      'canEditOutgoing',
      'canDeleteIncoming',
      'canDeleteOutgoing',
    ] as const) {
      const allowed = getAllowedColumns(withPermissions({ canView: true, [flag]: true }));
      expect(allowed).toContain('actions');
    }
  });

  it('canManageFiles opens files without opening actions', () => {
    const allowed = getAllowedColumns(withPermissions({ canView: true, canManageFiles: true }));
    expect(allowed).toContain('files');
    expect(allowed).not.toContain('actions');
  });

  it('the default list is the full allowed list when nothing is saved', () => {
    expect(resolveVisibleColumns(undefined, READ_ONLY)).toEqual(ALWAYS_ALLOWED_COLUMNS);
    expect(resolveVisibleColumns(undefined, FULL)).toEqual(DEFAULT_VISIBLE_COLUMNS);
  });

  it('a saved setting containing a now-forbidden column is filtered out', () => {
    const saved = ['seq', 'actions', 'subject', 'files', 'date'];
    expect(resolveVisibleColumns(saved, READ_ONLY)).toEqual(
      withColumnsAddedLater('seq', 'subject', 'date'),
    );
    expect(resolveVisibleColumns(saved, withPermissions({ canEditIncoming: true }))).toEqual(
      withColumnsAddedLater('seq', 'actions', 'subject', 'date'),
    );
    expect(resolveVisibleColumns(saved, withPermissions({ canManageFiles: true }))).toEqual(
      withColumnsAddedLater('seq', 'subject', 'files', 'date'),
    );
  });

  it('an edit flag alone does not open files — the flags are read independently', () => {
    // `getMailPermissions` выводит `canManageFiles` из флагов правки, поэтому
    // литерал с одним лишь `canEditIncoming` — это другое разрешение, чем то,
    // что вернёт хук, и колонка «Файлы» в нём закрыта.
    expect(getAllowedColumns(withPermissions({ canEditIncoming: true }))).not.toContain('files');
  });

  it('a saved setting keeps the order it was stored in', () => {
    const saved: MailColumnId[] = ['subject', 'seq', 'date'];
    expect(resolveVisibleColumns(saved, READ_ONLY)).toEqual(withColumnsAddedLater(...saved));
  });

  it('a column shipped after the layout was saved lands in its canonical position', () => {
    const saved: MailColumnId[] = ['subject', 'seq'];
    expect(resolveVisibleColumns(saved, FULL)).toEqual(withColumnsAddedLater(...saved));
  });

  it('a column the user deliberately hid is not restored', () => {
    // Сохранённый список не различает «я убрал» и «её тогда не было», поэтому
    // границей между ними служит исходный состав колонок на момент настройки.
    const saved = ['seq', 'subject'];
    expect(resolveVisibleColumns(saved, FULL)).toEqual(withColumnsAddedLater('seq', 'subject'));
  });

  it('an empty or malformed saved setting falls back to the defaults', () => {
    expect(resolveVisibleColumns([], FULL)).toEqual(DEFAULT_VISIBLE_COLUMNS);
    expect(resolveVisibleColumns(['nope', 42, null], FULL)).toEqual(DEFAULT_VISIBLE_COLUMNS);
    expect(resolveVisibleColumns('seq,date', FULL)).toEqual(DEFAULT_VISIBLE_COLUMNS);
    expect(resolveVisibleColumns({ seq: true }, FULL)).toEqual(DEFAULT_VISIBLE_COLUMNS);
  });

  it('a saved setting repeated twice is collapsed', () => {
    expect(resolveVisibleColumns(['seq', 'seq', 'date'], READ_ONLY)).toEqual(
      withColumnsAddedLater('seq', 'date'),
    );
  });

  it('getColumnSettingsItems returns only allowed columns with labels', () => {
    const guestItems = getColumnSettingsItems(READ_ONLY, 'incoming');
    expect(guestItems.map((item) => item.id)).toEqual(ALWAYS_ALLOWED_COLUMNS);
    expect(getColumnSettingsItems(FULL, 'incoming').map((item) => item.id)).toEqual(
      ALL_MAIL_COLUMNS.map((column) => column.id),
    );
    for (const item of guestItems) {
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it('settings items are labelled exactly like the table headers', () => {
    const incoming = getColumnSettingsItems(FULL, 'incoming');
    const outgoing = getColumnSettingsItems(FULL, 'outgoing');
    const headerFor = (items: MailColumnSettingItem[], id: MailColumnId) =>
      items.find((item) => item.id === id)?.label;

    expect(headerFor(incoming, 'counterparty')).toBe('Отправитель');
    expect(headerFor(outgoing, 'counterparty')).toBe('Получатель');
    expect(headerFor(incoming, 'number')).toBe('Номер письма');
    expect(headerFor(outgoing, 'number')).toBe('Исходящий номер');
    // Остальные подписи от регистра не зависят и остаются как в таблице.
    expect(headerFor(incoming, 'subject')).toBe('Тема');
    expect(headerFor(outgoing, 'subject')).toBe('Тема');

    // Список настроек и заголовки таблицы — один и тот же текст.
    expect(incoming.map((item) => item.label)).toEqual(
      getOrderedColumns(DEFAULT_VISIBLE_COLUMNS, 'incoming').map((column) => column.header),
    );
  });

  it('the thread column is not capability-gated and survives a read-only flag set', () => {
    expect(ALWAYS_ALLOWED_COLUMNS).toContain('thread');
    expect(getAllowedColumns(NO_MAIL_PERMISSIONS)).toContain('thread');
    expect(getAllowedColumns(READ_ONLY)).toContain('thread');
    expect(resolveVisibleColumns(undefined, READ_ONLY)).toContain('thread');
  });

  it('the thread column is visible by default', () => {
    expect(DEFAULT_VISIBLE_COLUMNS).toContain('thread');
  });

  it('the thread column is labelled the same for incoming and outgoing mail', () => {
    expect(getMailColumnLabel('thread', 'incoming')).toBe('Переписка');
    expect(getMailColumnLabel('thread', 'outgoing')).toBe('Переписка');
  });

  it('the thread column sits immediately before actions', () => {
    const ids = ALL_MAIL_COLUMNS.map((column) => column.id);
    expect(ids.indexOf('thread')).toBe(ids.indexOf('actions') - 1);
  });
});
