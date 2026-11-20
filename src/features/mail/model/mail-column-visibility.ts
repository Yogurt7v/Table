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
 * Колонки, существовавшие, когда настройка колонок появилась впервые.
 *
 * Нужны, чтобы отличать «пользователь убрал колонку» от «колонки тогда не
 * было». Сохранённый список хранит только оставшиеся колонки, и без этого
 * маркера дописывание новых колонок вернуло бы всё, что человек убрал
 * сознательно. Колонка, которой здесь нет, — новая: её дописываем к
 * сохранённому списку автоматически, иначе до ручного сброса настройки она
 * была бы не видна вообще.
 *
 * Экспортируется как часть контракта `resolveVisibleColumns`: тесты проверяют
 * именно эту границу, и второй её список в коде означал бы расхождение
 * копий при следующем добавлении колонки.
 */
export const COLUMNS_AT_LAYOUT_INTRO: MailColumnId[] = [
  'seq',
  'date',
  'number',
  'counterparty',
  'counterparty_number',
  'subject',
  'responsible_name',
  'delivery_method',
  'accounting_object_id',
  'files',
  'created',
  'actions',
];

/**
 * Сохранённый список пропускается через разрешённые: право могли отозвать уже
 * после того, как пользователь настроил колонки, и запрещённая колонка не должна
 * воскреснуть из хранилища. Пустое или битое значение откатывается к умолчанию —
 * тоже уже пересечённому с правами.
 *
 * Колонки, добавленные после того, как список сохранили, добавляются без
 * участия пользователя — иначе новая колонка не появилась бы до ручного сброса
 * настроек. Дописываются только те, которых нет в `COLUMNS_AT_LAYOUT_INTRO`:
 * осознанно убранные пользователем колонки возвращать нельзя.
 *
 * Порядок при этом не переписывается: сохранённые колонки идут в сохранённом
 * порядке, а новая встаёт на своё каноническое место относительно них — то есть
 * перед первой сохранённой, которая канонически идёт после неё. Добавление в
 * конец ломало бы привычное «Действия» последней колонкой.
 */
export function resolveVisibleColumns(
  saved: unknown,
  permissions: MailPermissions,
): MailColumnId[] {
  const allowed = new Set(getAllowedColumns(permissions));
  const picked = pickAllowedIds(saved, allowed);
  if (picked.length > 0) {
    const canonicalOrder = new Map(DEFAULT_VISIBLE_COLUMNS.map((id, index) => [id, index]));
    const kept = new Set(picked);
    const result = [...picked];
    for (const id of DEFAULT_VISIBLE_COLUMNS) {
      if (kept.has(id) || !allowed.has(id) || COLUMNS_AT_LAYOUT_INTRO.includes(id)) continue;
      const at = result.findIndex(
        (existing) => (canonicalOrder.get(existing) ?? 0) > (canonicalOrder.get(id) ?? 0),
      );
      if (at === -1) result.push(id);
      else result.splice(at, 0, id);
    }
    return result;
  }
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
