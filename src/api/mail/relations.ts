/** Связи между письмами (mail_relations) и записи в историю о связях. */

import { pb } from '../client.ts';
import type { IMailRelation, MailRelationSide, MailType } from '@/shared/types';
import { MAIL_RELATIONS_COLLECTION } from './constants.ts';
import { createMailHistory } from './history.ts';
import { currentActorId, currentActorName, qTag, relationSideFields } from './shared.ts';

/** Every link where the given incoming mail is either the parent or the child. */
export function getIncomingMailRelations(mailId: string) {
  return pb.collection(MAIL_RELATIONS_COLLECTION).getFullList<IMailRelation>({
    filter: `parent_incoming_mail_id = "${qTag(mailId)}" || child_incoming_mail_id = "${qTag(mailId)}"`,
    sort: '-created',
  });
}

/** Outgoing twin of `getIncomingMailRelations`. */
export function getOutgoingMailRelations(mailId: string) {
  return pb.collection(MAIL_RELATIONS_COLLECTION).getFullList<IMailRelation>({
    filter: `parent_outgoing_mail_id = "${qTag(mailId)}" || child_outgoing_mail_id = "${qTag(mailId)}"`,
    sort: '-created',
  });
}

/**
 * Creates one link between any two mails and writes a `linked` history entry on
 * BOTH ends. The four relation fields exist so either side of the link is a real
 * relation with cascadeDelete; this is the only place that decides which two of
 * them get set, and the incoming/outgoing wrappers below delegate to it.
 */
export async function createCrossMailRelation(
  parent: MailRelationSide,
  child: MailRelationSide,
  organizationId: string,
) {
  const parentSide = relationSideFields(parent);
  const childSide = relationSideFields(child);
  const relation = await pb.collection(MAIL_RELATIONS_COLLECTION).create<IMailRelation>({
    parent_incoming_mail_id: parentSide.incoming ?? '',
    parent_outgoing_mail_id: parentSide.outgoing ?? '',
    child_incoming_mail_id: childSide.incoming ?? '',
    child_outgoing_mail_id: childSide.outgoing ?? '',
    organization_id: organizationId,
    created_by: currentActorId(),
    created_by_name: currentActorName(),
  });

  await createMailHistory({
    mailId: parent.id,
    mailType: parent.type,
    organizationId,
    previousData: { relation_id: relation.id, child_id: child.id, child_type: child.type },
    type: 'linked',
  });
  await createMailHistory({
    mailId: child.id,
    mailType: child.type,
    organizationId,
    previousData: { relation_id: relation.id, parent_id: parent.id, parent_type: parent.type },
    type: 'linked',
  });

  return relation;
}

/** Links two incoming mails. */
export function createIncomingMailRelation(
  parentId: string,
  childId: string,
  organizationId: string,
) {
  return createCrossMailRelation(
    { id: parentId, type: 'incoming' },
    { id: childId, type: 'incoming' },
    organizationId,
  );
}

/** Links two outgoing mails. */
export function createOutgoingMailRelation(
  parentId: string,
  childId: string,
  organizationId: string,
) {
  return createCrossMailRelation(
    { id: parentId, type: 'outgoing' },
    { id: childId, type: 'outgoing' },
    organizationId,
  );
}

/**
 * Drops a link and records an `unlinked` entry on both ends. The link row is
 * read first because the history needs to name both mails it linked.
 */
export async function deleteMailRelation(relationId: string, organizationId: string) {
  const relation = await pb.collection(MAIL_RELATIONS_COLLECTION).getOne<IMailRelation>(relationId);

  await pb.collection(MAIL_RELATIONS_COLLECTION).delete(relationId);

  for (const [parentField, childField] of [
    ['parent_incoming_mail_id', 'child_incoming_mail_id'],
    ['parent_outgoing_mail_id', 'child_outgoing_mail_id'],
  ] as const) {
    const parentId = relation[parentField];
    const childId = relation[childField];
    if (!parentId || !childId) continue;
    const type: MailType = parentField === 'parent_incoming_mail_id' ? 'incoming' : 'outgoing';
    await createMailHistory({
      mailId: parentId,
      mailType: type,
      organizationId,
      previousData: { relation_id: relationId, child_id: childId, child_type: type },
      type: 'unlinked',
    });
    await createMailHistory({
      mailId: childId,
      mailType: type,
      organizationId,
      previousData: { relation_id: relationId, parent_id: parentId, parent_type: type },
      type: 'unlinked',
    });
  }
}
