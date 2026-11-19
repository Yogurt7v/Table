/** Внутренние помощники API почты: экранирование фильтров, актор и поля связей. */

import { pb } from '../client.ts';
import { getLastKnownUser } from '@/shared/auth/last-known-user';
import type { IMailRelation, MailRelationSide, MailType } from '@/shared/types';

/**
 * Escapes a value for a double-quoted PocketBase filter operand.
 * The filter grammar (fexpr scanner, `scanText`) unescapes exactly `\\`, `\'`
 * and `\"`, and preserves a backslash before anything else — so escaping only
 * those two characters is lossless and a `"` inside a search term can no longer
 * terminate the operand and inject filter syntax.
 */
export function qTag(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * `field ?= {a,b}` — the list form of the "any of" operator — is rejected by
 * PocketBase with 400 (verified on 0.38.2: the same field answered 400 for both
 * `{...}` and `[...]`, text and number alike). Only the repeated form works, so
 * the disjunction is spelled out here once and every caller shares it. Plain
 * equality joined by `||` is preferred over the repeated `?=` chain because it
 * is the simplest correct spelling and carries no operator-support risk across
 * PocketBase versions.
 */
export function anyOfEquals(field: string, values: string[]): string {
  return values.map((value) => `${field} = "${qTag(value)}"`).join(' || ');
}

/** Идентификатор текущего пользователя-актора (authStore или last-known). */
export function currentActorId(): string {
  return pb.authStore.model?.id ?? getLastKnownUser()?.id ?? '';
}

/** Отображаемое имя текущего пользователя-актора. */
export function currentActorName(): string {
  const model = pb.authStore.model ?? getLastKnownUser();
  return model?.name || model?.login || model?.email || '';
}

/** Поля связи письма, соответствующие стороне parent/child в relation. */
export function relationSideFields(side: MailRelationSide): {
  incoming?: string;
  outgoing?: string;
} {
  return side.type === 'incoming' ? { incoming: side.id } : { outgoing: side.id };
}

/** Идентификаторы писем-участников связи для указанного типа реестра. */
export function relationEndpoints(relation: IMailRelation, type: MailType): string[] {
  const prefix = type === 'incoming' ? 'incoming' : 'outgoing';
  const parent = relation[`parent_${prefix}_mail_id`];
  const child = relation[`child_${prefix}_mail_id`];
  return [parent, child].filter((id): id is string => !!id);
}
