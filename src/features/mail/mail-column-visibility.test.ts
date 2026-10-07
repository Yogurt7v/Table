import { describe, it, expect } from 'vitest';
import {
  ALWAYS_ALLOWED_COLUMNS,
  CAPABILITIES,
  COLUMNS_BY_CAPABILITY,
  getAllowedColumns,
  getColumnSettingsItems,
  resolveVisibleColumns,
} from './mail-column-visibility';
import type { MailColumnSettingItem } from './mail-column-visibility';
import { ALL_MAIL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, getOrderedColumns } from './mail-columns';
import type { MailColumnId } from './mail-columns';
import { NO_MAIL_PERMISSIONS } from './mail-field-access';
import type { MailPermissions } from './mail-field-access';

const withPermissions = (overrides: Partial<MailPermissions>): MailPermissions => ({
  ...NO_MAIL_PERMISSIONS,
  ...overrides,
});

const READ_ONLY = withPermissions({ canView: true });

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
    expect(resolveVisibleColumns(saved, READ_ONLY)).toEqual(['seq', 'subject', 'date']);
    expect(resolveVisibleColumns(saved, withPermissions({ canEditIncoming: true }))).toEqual([
      'seq',
      'actions',
      'subject',
      'date',
    ]);
    expect(resolveVisibleColumns(saved, withPermissions({ canManageFiles: true }))).toEqual([
      'seq',
      'subject',
      'files',
      'date',
    ]);
  });

  it('an edit flag alone does not open files — the flags are read independently', () => {
    // `getMailPermissions` выводит `canManageFiles` из флагов правки, поэтому
    // литерал с одним лишь `canEditIncoming` — это другое разрешение, чем то,
    // что вернёт хук, и колонка «Файлы» в нём закрыта.
    expect(getAllowedColumns(withPermissions({ canEditIncoming: true }))).not.toContain('files');
  });

  it('a saved setting keeps the order it was stored in', () => {
    const saved = ['subject', 'seq', 'date'];
    expect(resolveVisibleColumns(saved, READ_ONLY)).toEqual(saved);
  });

  it('an empty or malformed saved setting falls back to the defaults', () => {
    expect(resolveVisibleColumns([], FULL)).toEqual(DEFAULT_VISIBLE_COLUMNS);
    expect(resolveVisibleColumns(['nope', 42, null], FULL)).toEqual(DEFAULT_VISIBLE_COLUMNS);
    expect(resolveVisibleColumns('seq,date', FULL)).toEqual(DEFAULT_VISIBLE_COLUMNS);
    expect(resolveVisibleColumns({ seq: true }, FULL)).toEqual(DEFAULT_VISIBLE_COLUMNS);
  });

  it('a saved setting repeated twice is collapsed', () => {
    expect(resolveVisibleColumns(['seq', 'seq', 'date'], READ_ONLY)).toEqual(['seq', 'date']);
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
});
