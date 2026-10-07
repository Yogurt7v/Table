import { useMemo } from 'react';
import { useUpsertUserSetting, useUserSetting } from '@/shared/hooks/useUserSettings';
import type { MailNodeKey } from './mail-thread';
import type { MailOrderPlacement } from './mail-thread-builder';

/**
 * Порядок соседей в линии переписки — единственное, чего нет в связях.
 *
 * Иерархия живёт в `mail_relations`, и она единственная истина: номер письма и
 * номер контрагента её не определяют. А вот порядок между соседями по дате не
 * восстанавливается — две переписки одного дня с одной датой дали бы два разных
 * порядка при одних и тех же связях. Это решение человека, поэтому оно и
 * хранится.
 *
 * Хранится оно **по родителю**, а не одним списком: `родитель → [ключи]`. Список
 * один на всех выглядел бы проще, но место в нём общее для всей переписки, и
 * письмо, снятое с одного родителя и вставленное в конец, встало бы в начало
 * любой другой ветки — ровно тот эффект, ради которого порядок и выносят в
 * настройку. Внутри группы ключи не пересекаются, поэтому «в конец» значит
 * ровно «последним среди соседей», а «нет в настройке» — «после перечисленных,
 * в порядке реестра».
 *
 * Ключ, а не номер: уникального индекса на номерах нет, а восстановленное из
 * архива письмо получает новый id и сохраняет прежний `seq` — по номеру такое
 * письмо не отличить от оригинала.
 */

/** Ключ настройки. Отдельный от колонок и от всего прочего, что уже хранится. */
export const MAIL_THREAD_ORDER_KEY = 'mail_thread_order';

/** Группа писем без родителя — начала цепочек. */
const ROOT_GROUP = '';

/**
 * Потолок одной группы. Ключ уходит из группы, когда письмо меняет родителя или
 * удаляется, но страховка от бесконечного роста всё же нужна: обрезанные ключи
 * не теряются для пользователя, они просто возвращаются к порядку реестра.
 */
const GROUP_LIMIT = 200;

const MAIL_NODE_KEY_PATTERN = /^(incoming|outgoing):[A-Za-z0-9]+$/;

/** `родитель → ключи писем в порядке показа`. */
export type MailThreadOrder = Readonly<Record<string, readonly MailNodeKey[]>>;

/**
 * Разбор сохранённого значения. Всё, что не объект из массивов строк вида
 * `type:id`, считается отсутствующим порядком: пустой порядок — это ровно то
 * поведение, которое было до первого перетаскивания, и оно ничего не теряет,
 * потому что соседи просто встают в порядке реестра.
 */
export function parseMailThreadOrder(value: unknown): MailThreadOrder {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  const order: Record<string, MailNodeKey[]> = {};
  for (const [parentKey, rawGroup] of Object.entries(value)) {
    if (!Array.isArray(rawGroup)) continue;
    const seen = new Set<MailNodeKey>();
    const group: MailNodeKey[] = [];
    for (const item of rawGroup) {
      if (typeof item !== 'string' || !MAIL_NODE_KEY_PATTERN.test(item)) continue;
      const key = item as MailNodeKey;
      if (seen.has(key)) continue;
      seen.add(key);
      group.push(key);
    }
    if (group.length > 0) order[parentKey] = group;
  }
  return order;
}

/**
 * `ключ → позиция среди соседей`. Позиции разных групп не сравниваются между
 * собой — сравнение идёт только внутри группы, — поэтому сквозная нумерация не
 * нужна и не вводится.
 */
export function mailThreadOrderRanks(order: MailThreadOrder): ReadonlyMap<MailNodeKey, number> {
  const ranks = new Map<MailNodeKey, number>();
  for (const group of Object.values(order)) {
    group.forEach((key, index) => ranks.set(key, index));
  }
  return ranks;
}

/**
 * Новое место письма. Группа записывается целиком — в том порядке, в каком она
 * сейчас видна: сохранённый порядок хранит намерение человека, а не разницу с
 * прошлым состоянием, поэтому «поставить последним» означает «последним среди
 * соседей» даже когда часть соседей в настройке ещё не записана. Запись целиком
 * же и делает перестановку монотонной: сосед, который стоял выше, остаётся
 * выше, а не прыгает вниз оттого, что его ключ впервые попал в настройку.
 *
 * `siblings` — соседи нового родителя в текущем порядке показа; в него входит и
 * само письмо, если оно уже было среди них, поэтому индекс сдвигается на один.
 */
export function applyOrderPlacement(
  order: MailThreadOrder,
  parentKey: MailNodeKey | null,
  dragged: MailNodeKey,
  placement: MailOrderPlacement,
  siblings: readonly MailNodeKey[],
): MailThreadOrder {
  if (placement.kind === 'keep') return order;

  const rest: Record<string, MailNodeKey[]> = {};
  for (const [groupKey, group] of Object.entries(order)) {
    const filtered = group.filter((key) => key !== dragged);
    if (filtered.length > 0) rest[groupKey] = filtered;
  }

  const groupKey = parentKey ?? ROOT_GROUP;
  const wasAt = siblings.indexOf(dragged);
  const current = siblings.filter((key) => key !== dragged);
  const wanted =
    placement.kind === 'first' ? 0 : placement.kind === 'last' ? current.length : placement.index;
  const index = Math.min(
    Math.max(wasAt >= 0 && wasAt < wanted ? wanted - 1 : wanted, 0),
    current.length,
  );

  const next = [...current.slice(0, index), dragged, ...current.slice(index)].slice(-GROUP_LIMIT);
  return { ...rest, [groupKey]: next };
}

/**
 * Порядок линии переписки пользователя: чтение настроек и запись в них.
 *
 * Чтение переиспользует общий хук `useUserSetting`, поэтому кэш общий с
 * настройкой колонок и запроса не добавляется. Значение приходит как `unknown`:
 * разбирается здесь, и кривое значение даёт пустой порядок, а не исключение
 * посреди отрисовки.
 */
export function useMailThreadOrder() {
  const { data } = useUserSetting(MAIL_THREAD_ORDER_KEY);
  const save = useUpsertUserSetting(MAIL_THREAD_ORDER_KEY);

  const order = useMemo(() => parseMailThreadOrder(data), [data]);
  const ranks = useMemo(() => mailThreadOrderRanks(order), [order]);

  return {
    order,
    ranks,
    /** Записать новое место письма. Провал записи не ломает линию: она уже перерисована по связям. */
    place: (
      dragged: MailNodeKey,
      parentKey: MailNodeKey | null,
      placement: MailOrderPlacement,
      siblings: readonly MailNodeKey[],
    ) => {
      save.mutate(applyOrderPlacement(order, parentKey, dragged, placement, siblings));
    },
  };
}
