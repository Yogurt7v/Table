/** Построение фильтров PocketBase и клиентская дофильтрация для реестров почты. */

import type { ListResult } from 'pocketbase';
import { pb } from '@/api/client';
import type { IMailFile, IMailRelation, MailListParams, MailType } from '@/shared/types';
import { MAIL_FILES_COLLECTION, MAIL_RELATIONS_COLLECTION } from './constants.ts';
import { anyOfEquals, qTag, relationEndpoints } from './shared.ts';

interface MailFilterSpec {
  /** Field the `counterparty` param matches: sender for incoming, recipient for outgoing. */
  counterparty: string;
  /** Field `dateFrom`/`dateTo` bound. `deleted_at` on the archive registers. */
  dateField: string;
}

const INCOMING_SPEC: MailFilterSpec = {
  counterparty: 'sender',
  dateField: 'date',
};

const OUTGOING_SPEC: MailFilterSpec = {
  counterparty: 'recipient',
  dateField: 'date',
};

/** Собирает строку фильтра PocketBase для живого/архивного реестра писем. */
function buildMailFilter(params: MailListParams, spec: MailFilterSpec): string {
  const clauses: string[] = [`organization_id = "${qTag(params.organizationId)}"`];

  if (params.withoutAccountingObject) {
    clauses.push('accounting_object_id = null');
  } else if (params.accountingObjectIds?.length) {
    clauses.push(`(${anyOfEquals('accounting_object_id', params.accountingObjectIds)})`);
  }

  if (params.withoutDeliveryMethod) {
    clauses.push('(delivery_method = null || delivery_method = "")');
  } else if (params.deliveryMethods?.length) {
    clauses.push(`(${anyOfEquals('delivery_method', params.deliveryMethods)})`);
  }

  if (params.responsibleIds?.length) {
    const parts = params.responsibleIds.map((id) => `(responsible ~ "${qTag(id)}")`);
    clauses.push(`(${parts.join(' || ')})`);
  }

  const counterparty = params.counterparty?.trim();
  if (counterparty) {
    clauses.push(`${spec.counterparty} ~ "${qTag(counterparty)}"`);
  }

  // Date fields are stored as midnight-UTC strings, so a plain lexicographic
  // bound is a calendar-day bound — same trick getInvoices uses. The upper
  // bound needs the time tail or the whole `dateTo` day would be excluded.
  if (params.dateFrom) {
    clauses.push(`${spec.dateField} >= "${qTag(params.dateFrom)}"`);
  }
  if (params.dateTo) {
    clauses.push(`${spec.dateField} <= "${qTag(params.dateTo)} 23:59:59"`);
  }

  return clauses.join(' && ');
}

/** Фильтр входящего реестра (контрагент — отправитель, дата — date). */
export function buildIncomingMailFilter(params: MailListParams): string {
  return buildMailFilter(params, INCOMING_SPEC);
}

/** Фильтр исходящего реестра (контрагент — получатель, дата — date). */
export function buildOutgoingMailFilter(params: MailListParams): string {
  return buildMailFilter(params, OUTGOING_SPEC);
}

/** Фильтр архива удалённых входящих писем (дата — deleted_at). */
export function buildDeletedIncomingMailFilter(params: MailListParams): string {
  return buildMailFilter(params, { ...INCOMING_SPEC, dateField: 'deleted_at' });
}

/** Фильтр архива удалённых исходящих писем (дата — deleted_at). */
export function buildDeletedOutgoingMailFilter(params: MailListParams): string {
  return buildMailFilter(params, { ...OUTGOING_SPEC, dateField: 'deleted_at' });
}

/**
 * `withFiles` and `hasRelations` cannot be pushed into the filter: the
 * PocketBase client filter grammar (tools/search + the fexpr parser) has no
 * EXISTS subquery operator — only `= != > >= < <= ~ !~` and their `?` forms —
 * and `mail_files.mail_id` is plain text, so there is no relation to traverse
 * either. The invoice register hits the same wall and resolves it client-side
 * (`filesByInvoice` in InvoiceSection, built from `useOrgInvoiceFiles`), so these
 * two flags narrow the page that was already fetched and the totals are
 * recomputed from it rather than reporting a total for the unfiltered page.
 * A caller that needs an exact total for these flags must page the whole list.
 *
 * The two narrowing queries narrow by id, and they go out through `anyOfEquals`,
 * so they no longer emit the `?=` list operand that PocketBase answers with 400.
 * The flags are still applied client-side because the id lists only exist after
 * the page itself has been fetched.
 */
export async function applyClientOnlyMailFlags<T extends { id: string }>(
  page: ListResult<T>,
  params: MailListParams,
  type: MailType,
): Promise<ListResult<T>> {
  const needsFiles = params.withFiles === true;
  const needsRelations = params.hasRelations === true;
  if (!needsFiles && !needsRelations) return page;
  if (page.items.length === 0) return page;

  const ids = page.items.map((item) => item.id);

  const attachedMailIds = new Set<string>();
  if (needsFiles) {
    const files = await pb.collection(MAIL_FILES_COLLECTION).getFullList<IMailFile>({
      filter: `(${anyOfEquals('mail_id', ids)}) && mail_type = "${type}"`,
      fields: 'mail_id',
    });
    files.forEach((file) => attachedMailIds.add(file.mail_id));
  }

  const linkedMailIds = new Set<string>();
  if (needsRelations) {
    const field = type === 'incoming' ? 'incoming_mail_id' : 'outgoing_mail_id';
    const relations = await pb.collection(MAIL_RELATIONS_COLLECTION).getFullList<IMailRelation>({
      filter: `(${anyOfEquals(`parent_${field}`, ids)}) || (${anyOfEquals(`child_${field}`, ids)})`,
      fields:
        'id,parent_incoming_mail_id,parent_outgoing_mail_id,child_incoming_mail_id,child_outgoing_mail_id',
    });
    relations.forEach((relation) =>
      relationEndpoints(relation, type).forEach((id) => linkedMailIds.add(id)),
    );
  }

  const items = page.items.filter(
    (item) =>
      (!needsFiles || attachedMailIds.has(item.id)) &&
      (!needsRelations || linkedMailIds.has(item.id)),
  );

  return { ...page, items, totalItems: items.length, totalPages: items.length === 0 ? 0 : 1 };
}
