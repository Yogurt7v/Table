/** Разрешение намерения родителя и планирование изменений связей в mail_relations. */

import type { IMailRelation } from '@/shared/types';
import { resolveRelationEdge } from '../mail-thread';
import type { MailEdge, MailNodeKey } from '../mail-thread';
import type { LinkChangePlan, MailCandidate, ParentEdgeIndex, ParentIntent } from './types';

/**
 * Родитель, который будет записан при сохранении. `pending` — не решение, а
 * его отсутствие, поэтому возвращает уже сохранённого родителя; `declined` —
 * `null`, то есть письмо становится началом цепочки.
 *
 * Отвечает на вопрос «что человек решил», поэтому выбранный ключ проверяется
 * по индексу: письмо могли удалить, а выбор — остаться. Провалившийся выбор
 * тихо падает в «новую цепочку», а не в «связь с несуществующим письмом».
 */
export function intendedParentKey(
  intent: ParentIntent,
  savedParentKey: MailNodeKey | null,
): MailNodeKey | null {
  if (intent.kind === 'picked') return intent.key;
  if (intent.kind === 'declined') return null;
  return savedParentKey;
}

/**
 * `ребёнок → рёбра, где он ребёнок`. Именно эта сторона связи меняется, когда
 * человек заново называет родителя; родительские рёбра письма (оно само на
 * что-то отвечает) этого не касаются и остаются нетронутыми.
 */
export function buildParentEdgeIndex(relations: readonly IMailRelation[]): ParentEdgeIndex {
  const index = new Map<MailNodeKey, MailEdge[]>();
  for (const relation of relations) {
    const edge = resolveRelationEdge(relation);
    if (!edge) continue;
    const bucket = index.get(edge.child.key);
    if (bucket) {
      bucket.push(edge);
    } else {
      index.set(edge.child.key, [edge]);
    }
  }
  return index;
}

/** Рёбра, в которых письмо выступает ребёнком (его текущие родители). */
export function parentEdgesOf(
  index: ParentEdgeIndex | undefined,
  key: MailNodeKey | null,
): readonly MailEdge[] {
  if (!index || !key) return [];
  return index.get(key) ?? [];
}

/**
 * Что записать, когда человек заново назвал родителя. `null` означает «ничего
 * не трогать» — и это страховка от лишней записи, а не экономия запроса: если
 * единственный родитель остался тем же, снятие и создание той же связи дали бы
 * две лишние записи `unlinked`/`linked` в истории при неизменном результате.
 * Поэтому сравниваются ключи родителей, а не сам факт наличия связи.
 *
 * План не зависит от номера контрагента вообще: правка номера не пишет связь
 * и потому сюда не приводит.
 */
export function planLinkChange(
  existing: readonly MailEdge[],
  nextParent: MailCandidate | null,
): LinkChangePlan | null {
  const currentParents = new Set(existing.map((edge) => edge.parent.key));
  if (!nextParent && currentParents.size === 0) return null;
  if (nextParent && currentParents.size === 1 && currentParents.has(nextParent.key)) return null;
  return { drop: existing, create: nextParent };
}
