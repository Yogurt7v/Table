import type { MailPermissions } from './mail-field-access';
import { ALL_MAIL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, getMailColumnLabel } from './mail-columns';
import type { MailColumnId } from './mail-columns';
import type { MailType } from '@/shared/types';

export interface MailColumnSettingItem {
  id: MailColumnId;
  label: string;
}

/**
 * Почта не ролевая, а флаговая: реестр писем открывают по `can_view_mails`, а
 * отдельные колонки — по независимым `can_*_mails`. Поэтому здесь не таблица
 * ролей, как в `invoice-column-visibility.ts`, а таблица ВОЗМОЖНОСТЕЙ: строка
 * `role` не читается ни разу, и колонку открывает ровно одна строка таблицы.
 */

/** Возможность, которой колонка обязана быть разрешена. */
export type MailColumnCapability = 'actions' | 'files';

/**
 * Кто открывает колонку. `actions` — любая из четырёх прав на правку/удаление
 * входящих и исходящих; `files` — `canManageFiles`, то есть право прикреплять
 * вложения, которое само по себе не даёт ни правки письма, ни кнопок действий.
 * Всё остальное — чтение регистра, доступное любому, у кого есть `canView`.
 */
export const COLUMNS_BY_CAPABILITY: Record<MailColumnCapability, MailColumnId[]> = {
  actions: ['actions'],
  files: ['files'],
};

export const CAPABILITIES: MailColumnCapability[] = ['actions', 'files'];

/** Колонки, доступные всем, кто видит реестр. */
export const ALWAYS_ALLOWED_COLUMNS: MailColumnId[] = ALL_MAIL_COLUMNS.filter(
  (column) =>
    !CAPABILITIES.some((capability) => COLUMNS_BY_CAPABILITY[capability].includes(column.id)),
).map((column) => column.id);

function hasCapability(permissions: MailPermissions, capability: MailColumnCapability): boolean {
  if (capability === 'files') return permissions.canManageFiles;
  return (
    permissions.canEditIncoming ||
    permissions.canEditOutgoing ||
    permissions.canDeleteIncoming ||
    permissions.canDeleteOutgoing
  );
}

/**
 * Разрешённые колонки в каноническом порядке — источник истины для реестра.
 * Порядок здесь ещё не пользовательский: его задаёт `resolveVisibleColumns`.
 */
export function getAllowedColumns(permissions: MailPermissions): MailColumnId[] {
  const allowed = new Set<MailColumnId>(ALWAYS_ALLOWED_COLUMNS);
  for (const capability of CAPABILITIES) {
    if (!hasCapability(permissions, capability)) continue;
    for (const id of COLUMNS_BY_CAPABILITY[capability]) allowed.add(id);
  }
  return ALL_MAIL_COLUMNS.filter((column) => allowed.has(column.id)).map((column) => column.id);
}

function pickAllowedIds(saved: unknown, allowed: Set<MailColumnId>): MailColumnId[] {
  if (!Array.isArray(saved)) return [];
  const result: MailColumnId[] = [];
  for (const id of saved) {
    if (typeof id !== 'string' || !allowed.has(id as MailColumnId)) continue;
    if (result.includes(id as MailColumnId)) continue;
    result.push(id as MailColumnId);
  }
  return result;
}

/**
 * Сохранённый список пропускается через разрешённые: право могли отозвать уже
 * после того, как пользователь настроил колонки, и запрещённая колонка не должна
 * воскреснуть из хранилища. Пустое или битое значение откатывается к умолчанию —
 * тоже уже пересечённому с правами.
 */
export function resolveVisibleColumns(
  saved: unknown,
  permissions: MailPermissions,
): MailColumnId[] {
  const allowed = new Set(getAllowedColumns(permissions));
  const picked = pickAllowedIds(saved, allowed);
  if (picked.length > 0) return picked;
  return DEFAULT_VISIBLE_COLUMNS.filter((id) => allowed.has(id));
}

/**
 * Строки настройки колонок: только разрешённые, с теми же подписями, что в
 * заголовке таблицы. `mailType` обязателен не для красоты: у входящих колонка
 * контрагента называется «Отправитель», у исходящих — «Получатель», и список
 * настроек обязан называть её тем же, чем называет таблица, иначе строку в
 * списке не с чем сопоставить.
 */
export function getColumnSettingsItems(
  permissions: MailPermissions,
  mailType: MailType,
): MailColumnSettingItem[] {
  const allowed = new Set(getAllowedColumns(permissions));
  return ALL_MAIL_COLUMNS.filter((column) => allowed.has(column.id)).map((column) => ({
    id: column.id,
    label: getMailColumnLabel(column.id, mailType),
  }));
}
