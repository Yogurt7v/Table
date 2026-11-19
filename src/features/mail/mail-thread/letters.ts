/** Индекс писем организации и загрузка писем/связей для построения переписки. */

import { pb } from '@/api/client';
import {
  MAIL_INCOMING_COLLECTION,
  MAIL_OUTGOING_COLLECTION,
  MAIL_RELATIONS_COLLECTION,
} from '@/api/mail';
import type { IIncomingMail, IMailRelation, IOutgoingMail, MailType } from '@/shared/types';
import { relationCounterparty, relationNumber } from '../mail-relations';
import { mailNodeKey } from './graph.ts';
import type { MailLetter, MailLetterIndex, MailNodeKey, OrgMailLetters } from './types';

/** Письмо без seq уходит в конец списка. */
const UNSEQUENCED_SORT_VALUE = Number.MAX_SAFE_INTEGER;

/** Письма одного регистра в общую карту подписей. */
function addLetters(
  index: Map<MailNodeKey, MailLetter>,
  type: MailType,
  mails: readonly (IIncomingMail | IOutgoingMail)[],
): void {
  for (const mail of mails) {
    const key = mailNodeKey(type, mail.id);
    index.set(key, {
      key,
      date: mail.date,
      seq: mail.seq ?? UNSEQUENCED_SORT_VALUE,
      number: relationNumber(type, mail),
      counterparty: relationCounterparty(type, mail),
      subject: mail.subject,
    });
  }
}

/**
 * `ключ → строка письма` для организации. В `mail_relations` хранятся только id,
 * а `useIncomingMail`/`useOutgoingMail` на каждый узел дали бы N+1 — поэтому
 * письма читаются по регистру целиком и раскладываются в карту один раз.
 */
export function buildLetterIndex(
  incoming: readonly IIncomingMail[],
  outgoing: readonly IOutgoingMail[],
): MailLetterIndex {
  const index = new Map<MailNodeKey, MailLetter>();
  addLetters(index, 'incoming', incoming);
  addLetters(index, 'outgoing', outgoing);
  return index;
}

const LETTER_FIELDS =
  'id,organization_id,date,seq,number,outgoing_number,sender,recipient,subject,responsible';

const RELATION_FIELDS =
  'id,organization_id,parent_incoming_mail_id,parent_outgoing_mail_id,child_incoming_mail_id,child_outgoing_mail_id';

/**
 * Связи всей организации одним запросом — по образцу `useOrgMailFiles`. Сбор
 * «связи этого письма» (`getIncomingMailRelations`) для дерева не годится: ветка
 * тянется в обе стороны, и любая выборка обрывает её за пределами первого шага.
 * Фильтр по организации обязателен — иначе в дерево попало бы чужое письмо с
 * тем же id.
 */
export function fetchOrgMailRelations(orgId: string): Promise<IMailRelation[]> {
  return pb.collection(MAIL_RELATIONS_COLLECTION).getFullList<IMailRelation>({
    filter: `organization_id = "${orgId}"`,
    fields: RELATION_FIELDS,
    sort: 'created',
  });
}

/**
 * Письма организации — по одному запросу на регистр. Цена не зависит от размера
 * дерева: вместе со связями это ровно три запроса на открытие модалки, сколько
 * бы ветвей ни было.
 */
export function fetchOrgMailLetters(orgId: string): Promise<OrgMailLetters> {
  const filter = `organization_id = "${orgId}"`;
  const options = { filter, fields: LETTER_FIELDS, sort: 'date,seq' };
  return Promise.all([
    pb.collection(MAIL_INCOMING_COLLECTION).getFullList<IIncomingMail>(options),
    pb.collection(MAIL_OUTGOING_COLLECTION).getFullList<IOutgoingMail>(options),
  ]).then(([incoming, outgoing]) => ({ incoming, outgoing }));
}
