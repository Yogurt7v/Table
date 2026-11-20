import type { IIncomingMail, IOutgoingMail, MailType } from '@/shared/types';
import { mailNodeKey } from '../../mail-thread';
import type { MailNodeKey } from '../../mail-thread';
import { PENDING_PARENT_INTENT, parentEdgesOf } from '../../mail-parent';
import type { ParentEdgeIndex, ParentIntent } from '../../mail-parent';

/** Ключ уже сохранённого родителя — им форма открывается, а не угадывается заново. */
export function savedParentKey(
  parentEdges: ParentEdgeIndex | undefined,
  mailType: MailType,
  mail: IIncomingMail | IOutgoingMail | null,
): MailNodeKey | null {
  if (!mail) return null;
  const first = parentEdgesOf(parentEdges, mailNodeKey(mailType, mail.id))[0];
  return first?.parent.key ?? null;
}

/**
 * Форма открывается с сохранённым родителем как `picked`, а не как отсутствие
 * решения: пока человек не трогал связь, предлагать ему то же самое заново незачем.
 */
export function initialIntent(
  parentEdges: ParentEdgeIndex | undefined,
  mailType: MailType,
  mail: IIncomingMail | IOutgoingMail | null,
): ParentIntent {
  const saved = savedParentKey(parentEdges, mailType, mail);
  return saved ? { kind: 'picked', key: saved } : PENDING_PARENT_INTENT;
}

/**
 * Список ответственных из строки формы. Разбор идёт с обрезкой краёв, потому что
 * строка приходит из базы, а писал её прежний разбор: у одного второго
 * ответственного без обрезки не нашлось бы подписи и он читался пустым.
 */
export function parseResponsible(value: string): string[] {
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
