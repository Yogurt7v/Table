import type { IIncomingMail, IMailRelation, IOutgoingMail, MailType } from '@/shared/types';

/**
 * Разбор строки `mail_relations`. В ней заполнены ровно два из четырёх id —
 * по одному на сторону связи, — и какой именно, решает тип регистра, с
 * которого открыта модалка.
 */
export function relationEndpoints(
  relation: IMailRelation,
  mailType: MailType,
): { parentId: string; childId: string } {
  return mailType === 'incoming'
    ? {
        parentId: relation.parent_incoming_mail_id ?? '',
        childId: relation.child_incoming_mail_id ?? '',
      }
    : {
        parentId: relation.parent_outgoing_mail_id ?? '',
        childId: relation.child_outgoing_mail_id ?? '',
      };
}

export function relationCounterparty(mailType: MailType, mail: IIncomingMail | IOutgoingMail) {
  return mailType === 'incoming'
    ? (mail as IIncomingMail).sender
    : (mail as IOutgoingMail).recipient;
}

export function relationNumber(mailType: MailType, mail: IIncomingMail | IOutgoingMail) {
  return mailType === 'incoming'
    ? ((mail as IIncomingMail).number ?? '')
    : (mail as IOutgoingMail).outgoing_number;
}
