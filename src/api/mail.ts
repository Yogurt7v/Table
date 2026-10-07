import type { ListResult } from 'pocketbase';
import { pb } from './client.ts';
import type {
  DeliveryMethod,
  IDeletedIncomingMail,
  IDeletedMailHistory,
  IDeletedOutgoingMail,
  IIncomingMail,
  IMailFile,
  IMailHistory,
  IMailRelation,
  IOrganizationUser,
  IOutgoingMail,
  MailHistoryType,
  MailListParams,
  MailPermissionFlags,
  MailRelationSide,
  MailType,
} from '@/shared/types';

export const MAIL_INCOMING_COLLECTION = 'incoming_mails';
export const MAIL_OUTGOING_COLLECTION = 'outgoing_mails';
export const MAIL_FILES_COLLECTION = 'mail_files';
export const MAIL_HISTORY_COLLECTION = 'mail_history';
export const MAIL_RELATIONS_COLLECTION = 'mail_relations';
export const DELETED_MAIL_INCOMING_COLLECTION = 'deleted_incoming_mails';
export const DELETED_MAIL_OUTGOING_COLLECTION = 'deleted_outgoing_mails';
export const DELETED_MAIL_HISTORY_COLLECTION = 'deleted_mail_history';
export const ORGANIZATION_USERS_COLLECTION = 'organization_users';

export const MAIL_PAGE_SIZE = 20;

/**
 * Размер страницы архива удалённых писем — отдельная константа, а не
 * `MAIL_PAGE_SIZE`, чтобы смена размера страницы реестра не меняла архив
 * молча. Сама админская секция (`DeletedMailsSection`) передаёт `perPage`
 * явно, поэтому это значение — только защитный умолчательный аргумент.
 */
const ARCHIVE_MAIL_PAGE_SIZE = 20;

/**
 * Порядок живого реестра — «новые сверху», включая письма одного дня.
 *
 * Префикс `-` в PocketBase — это DESC, поэтому прежняя строка `-date,seq`
 * читалась как `date` DESC, `seq` ASC: внутри одного календарного дня наверху
 * оказывалось письмо с наименьшим `seq`, то есть самое старое за этот день, —
 * ровно наоборот остальному порядку. `seq` у писем счётчик org-scoped
 * (`pb_hooks/mail-notify.pb.js`: MAX(seq)+1 по организации), а не по дате, так
 * что больший `seq` — всегда более позднее письмо, и внутри дня сортировать его
 * надо тоже по убыванию.
 *
 * Последний ключ — `-created` — не косметика. `seq` не уникален: восстановление
 * из архива создаёт запись под НОВЫМ id, но сохраняет прежний `seq`, а API
 * позволяет создать письмо с явным `seq`, поэтому два письма могут совпасть и по
 * `date`, и по `seq`. Без последнего ключа PocketBase оставляет равные строки в
 * произвольном порядке, и при постраничном чтении (OFFSET/LIMIT) та же строка
 * способна попасть на две соседние страницы или пропасть между ними.
 * `created` заполняется всегда и монотонно растёт, поэтому он делает порядок
 * полностью детерминированным.
 */
const LIVE_MAIL_SORT = '-date,-seq,-created';
const ARCHIVE_SORT = '-deleted_at';

/**
 * Escapes a value for a double-quoted PocketBase filter operand.
 * The filter grammar (fexpr scanner, `scanText`) unescapes exactly `\\`, `\'`
 * and `\"`, and preserves a backslash before anything else — so escaping only
 * those two characters is lossless and a `"` inside a search term can no longer
 * terminate the operand and inject filter syntax.
 */
function qTag(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function qList(values: string[]): string {
  return values.map((v) => `"${qTag(v)}"`).join(',');
}

interface MailFilterSpec {
  /** Field the `counterparty` param matches: sender for incoming, recipient for outgoing. */
  counterparty: string;
  /** Fields the free-text `search` is matched against, OR-ed together. */
  searchFields: string[];
  /** Field `dateFrom`/`dateTo` bound. `deleted_at` on the archive registers. */
  dateField: string;
}

const INCOMING_SPEC: MailFilterSpec = {
  counterparty: 'sender',
  searchFields: [
    'number',
    'sender_outgoing_number',
    'subject',
    'sender',
    'comment',
    'responsible_name',
  ],
  dateField: 'date',
};

const OUTGOING_SPEC: MailFilterSpec = {
  counterparty: 'recipient',
  searchFields: [
    'outgoing_number',
    'counterparty_incoming_number',
    'subject',
    'recipient',
    'comment',
    'responsible_name',
  ],
  dateField: 'date',
};

function buildMailFilter(params: MailListParams, spec: MailFilterSpec): string {
  const clauses: string[] = [`organization_id = "${qTag(params.organizationId)}"`];

  if (params.withoutAccountingObject) {
    clauses.push('accounting_object_id = null');
  } else if (params.accountingObjectIds?.length) {
    clauses.push(`accounting_object_id ?= {${qList(params.accountingObjectIds)}}`);
  }

  if (params.withoutDeliveryMethod) {
    clauses.push('(delivery_method = null || delivery_method = "")');
  } else if (params.deliveryMethods?.length) {
    clauses.push(`delivery_method ?= {${qList(params.deliveryMethods)}}`);
  }

  if (params.responsibleIds?.length) {
    clauses.push(`responsible ?= {${qList(params.responsibleIds)}}`);
  }

  const counterparty = params.counterparty?.trim();
  if (counterparty) {
    clauses.push(`${spec.counterparty} ~ "${qTag(counterparty)}"`);
  }

  const search = params.search?.trim();
  if (search) {
    const term = qTag(search);
    clauses.push(`(${spec.searchFields.map((field) => `${field} ~ "${term}"`).join(' || ')})`);
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

function buildIncomingMailFilter(params: MailListParams): string {
  return buildMailFilter(params, INCOMING_SPEC);
}

function buildOutgoingMailFilter(params: MailListParams): string {
  return buildMailFilter(params, OUTGOING_SPEC);
}

function buildDeletedIncomingMailFilter(params: MailListParams): string {
  return buildMailFilter(params, { ...INCOMING_SPEC, dateField: 'deleted_at' });
}

function buildDeletedOutgoingMailFilter(params: MailListParams): string {
  return buildMailFilter(params, { ...OUTGOING_SPEC, dateField: 'deleted_at' });
}

function currentActorId(): string {
  return pb.authStore.model?.id ?? '';
}

function currentActorName(): string {
  return pb.authStore.model?.name || pb.authStore.model?.login || pb.authStore.model?.email || '';
}

function relationSideFields(side: MailRelationSide): {
  incoming?: string;
  outgoing?: string;
} {
  return side.type === 'incoming' ? { incoming: side.id } : { outgoing: side.id };
}

function relationEndpoints(relation: IMailRelation, type: MailType): string[] {
  const prefix = type === 'incoming' ? 'incoming' : 'outgoing';
  const parent = relation[`parent_${prefix}_mail_id`];
  const child = relation[`child_${prefix}_mail_id`];
  return [parent, child].filter((id): id is string => !!id);
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
 */
async function applyClientOnlyMailFlags<T extends { id: string }>(
  page: ListResult<T>,
  params: MailListParams,
  type: MailType,
): Promise<ListResult<T>> {
  const needsFiles = params.withFiles === true;
  const needsRelations = params.hasRelations === true;
  if (!needsFiles && !needsRelations) return page;
  if (page.items.length === 0) return page;

  const ids = page.items.map((item) => item.id);
  const candidates = qList(ids);

  const attachedMailIds = new Set<string>();
  if (needsFiles) {
    const files = await pb.collection(MAIL_FILES_COLLECTION).getFullList<IMailFile>({
      filter: `mail_id ?= {${candidates}} && mail_type = "${type}"`,
      fields: 'mail_id',
    });
    files.forEach((file) => attachedMailIds.add(file.mail_id));
  }

  const linkedMailIds = new Set<string>();
  if (needsRelations) {
    const field = type === 'incoming' ? 'incoming_mail_id' : 'outgoing_mail_id';
    const relations = await pb.collection(MAIL_RELATIONS_COLLECTION).getFullList<IMailRelation>({
      filter: `parent_${field} ?= {${candidates}} || child_${field} ?= {${candidates}}`,
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

// --- Registers ---

/** Paginated incoming mail register for one organization, newest first. */
export function getIncomingMails(params: MailListParams): Promise<ListResult<IIncomingMail>> {
  return pb
    .collection(MAIL_INCOMING_COLLECTION)
    .getList<IIncomingMail>(params.page ?? 1, params.perPage ?? MAIL_PAGE_SIZE, {
      filter: buildIncomingMailFilter(params),
      sort: params.sort ?? LIVE_MAIL_SORT,
    })
    .then((page) => applyClientOnlyMailFlags(page, params, 'incoming'));
}

/** Paginated outgoing mail register for one organization, newest first. */
export function getOutgoingMails(params: MailListParams): Promise<ListResult<IOutgoingMail>> {
  return pb
    .collection(MAIL_OUTGOING_COLLECTION)
    .getList<IOutgoingMail>(params.page ?? 1, params.perPage ?? MAIL_PAGE_SIZE, {
      filter: buildOutgoingMailFilter(params),
      sort: params.sort ?? LIVE_MAIL_SORT,
    })
    .then((page) => applyClientOnlyMailFlags(page, params, 'outgoing'));
}

export function getIncomingMail(id: string) {
  return pb.collection(MAIL_INCOMING_COLLECTION).getOne<IIncomingMail>(id);
}

export function getOutgoingMail(id: string) {
  return pb.collection(MAIL_OUTGOING_COLLECTION).getOne<IOutgoingMail>(id);
}

export type CreateIncomingMailInput = {
  organization_id: string;
  date: string;
  subject: string;
  sender: string;
  responsible: string;
  accounting_object_id?: string;
  seq?: number;
  number?: string;
  sender_outgoing_number?: string;
  responsible_name?: string;
  delivery_method?: DeliveryMethod;
  comment?: string;
};

export type CreateOutgoingMailInput = {
  organization_id: string;
  date: string;
  subject: string;
  recipient: string;
  responsible: string;
  outgoing_number: string;
  accounting_object_id?: string;
  seq?: number;
  counterparty_incoming_number?: string;
  responsible_name?: string;
  delivery_method?: DeliveryMethod;
  comment?: string;
};

/**
 * Creates an incoming mail. Actor fields are written here because the
 * actor-name hooks in notify.pb.js are scoped to the `invoices` collection.
 */
export function createIncomingMail(data: CreateIncomingMailInput) {
  const actorId = currentActorId();
  const actorName = currentActorName();
  return pb.collection(MAIL_INCOMING_COLLECTION).create<IIncomingMail>({
    organization_id: data.organization_id,
    date: data.date.slice(0, 10),
    subject: data.subject,
    sender: data.sender,
    responsible: data.responsible,
    accounting_object_id: data.accounting_object_id ?? '',
    seq: data.seq,
    number: data.number ?? '',
    sender_outgoing_number: data.sender_outgoing_number ?? '',
    responsible_name: data.responsible_name ?? actorName,
    delivery_method: data.delivery_method,
    comment: data.comment ?? '',
    created_by: actorId,
    created_by_name: actorName,
    updated_by: actorId,
    updated_by_name: actorName,
  });
}

/** Outgoing twin of `createIncomingMail`. */
export function createOutgoingMail(data: CreateOutgoingMailInput) {
  const actorId = currentActorId();
  const actorName = currentActorName();
  return pb.collection(MAIL_OUTGOING_COLLECTION).create<IOutgoingMail>({
    organization_id: data.organization_id,
    date: data.date.slice(0, 10),
    subject: data.subject,
    recipient: data.recipient,
    responsible: data.responsible,
    outgoing_number: data.outgoing_number,
    accounting_object_id: data.accounting_object_id ?? '',
    seq: data.seq,
    counterparty_incoming_number: data.counterparty_incoming_number ?? '',
    responsible_name: data.responsible_name ?? actorName,
    delivery_method: data.delivery_method,
    comment: data.comment ?? '',
    created_by: actorId,
    created_by_name: actorName,
    updated_by: actorId,
    updated_by_name: actorName,
  });
}

/**
 * Updates an incoming mail, writing the `mail_history` row first — the same
 * contract as updateInvoiceWithHistory: if the update fails the audit trail
 * still records the state the mail was in before the attempt. `organization_id`
 * is read off the record rather than taken from `data`, because mail_history
 * requires it and a caller updating one field must not have to resend it.
 */
export async function updateIncomingMail(
  id: string,
  data: Partial<IIncomingMail>,
  previousData: Record<string, unknown>,
) {
  const current = await pb
    .collection(MAIL_INCOMING_COLLECTION)
    .getOne<IIncomingMail>(id, { fields: 'organization_id' });

  await createMailHistory({
    mailId: id,
    mailType: 'incoming',
    organizationId: current.organization_id,
    previousData,
    type: 'updated',
  });

  const actorId = currentActorId();
  const actorName = currentActorName();
  return pb
    .collection(MAIL_INCOMING_COLLECTION)
    .update<IIncomingMail>(id, { ...data, updated_by: actorId, updated_by_name: actorName });
}

/** Outgoing twin of `updateIncomingMail`. */
export async function updateOutgoingMail(
  id: string,
  data: Partial<IOutgoingMail>,
  previousData: Record<string, unknown>,
) {
  const current = await pb
    .collection(MAIL_OUTGOING_COLLECTION)
    .getOne<IOutgoingMail>(id, { fields: 'organization_id' });

  await createMailHistory({
    mailId: id,
    mailType: 'outgoing',
    organizationId: current.organization_id,
    previousData,
    type: 'updated',
  });

  const actorId = currentActorId();
  const actorName = currentActorName();
  return pb
    .collection(MAIL_OUTGOING_COLLECTION)
    .update<IOutgoingMail>(id, { ...data, updated_by: actorId, updated_by_name: actorName });
}

// --- History ---

export type CreateMailHistoryParams = {
  mailId: string;
  mailType: MailType;
  organizationId: string;
  previousData: Record<string, unknown>;
  type: MailHistoryType;
};

/**
 * Appends one `mail_history` row for either register. `author` is the user id
 * (not a relation — the display name is snapshotted into `author_name`), and
 * only the relation field matching `mailType` is set.
 */
export function createMailHistory(params: CreateMailHistoryParams) {
  return pb.collection(MAIL_HISTORY_COLLECTION).create<IMailHistory>({
    incoming_mail_id: params.mailType === 'incoming' ? params.mailId : '',
    outgoing_mail_id: params.mailType === 'outgoing' ? params.mailId : '',
    organization_id: params.organizationId,
    author: currentActorId(),
    author_name: currentActorName(),
    changed_at: new Date().toISOString(),
    type: params.type,
    previous_data: params.previousData,
  });
}

export function getIncomingMailHistory(mailId: string) {
  return pb.collection(MAIL_HISTORY_COLLECTION).getFullList<IMailHistory>({
    filter: `incoming_mail_id = "${qTag(mailId)}"`,
    sort: '-changed_at',
  });
}

export function getOutgoingMailHistory(mailId: string) {
  return pb.collection(MAIL_HISTORY_COLLECTION).getFullList<IMailHistory>({
    filter: `outgoing_mail_id = "${qTag(mailId)}"`,
    sort: '-changed_at',
  });
}

export function getDeletedIncomingMailHistory(deletedMailId: string) {
  return pb.collection(DELETED_MAIL_HISTORY_COLLECTION).getFullList<IDeletedMailHistory>({
    filter: `deleted_incoming_mail_id = "${qTag(deletedMailId)}"`,
    sort: '-changed_at',
  });
}

export function getDeletedOutgoingMailHistory(deletedMailId: string) {
  return pb.collection(DELETED_MAIL_HISTORY_COLLECTION).getFullList<IDeletedMailHistory>({
    filter: `deleted_outgoing_mail_id = "${qTag(deletedMailId)}"`,
    sort: '-changed_at',
  });
}

// --- Delete + archive ---

/**
 * Archives an incoming mail and deletes the original — the same three-step
 * order deleteInvoice uses (archive row first, because the archive history row
 * needs its id, then delete).
 *
 * `mail_history` and `mail_relations` rows are NOT touched: every one of their
 * four relation fields is a real relation with cascadeDelete, so they go with
 * the mail itself. `mail_files` rows are deliberately left in place — mail_id
 * is plain text, not a relation, so the attachments outlive the delete and stay
 * openable from the archive. That is the reason for the polymorphic pair.
 */
export async function deleteIncomingMail(id: string) {
  const mail = await pb.collection(MAIL_INCOMING_COLLECTION).getOne<IIncomingMail>(id);
  const deletedBy = currentActorId();
  const deletedByName = currentActorName();
  const deletedAt = new Date().toISOString();

  const archived = await pb
    .collection(DELETED_MAIL_INCOMING_COLLECTION)
    .create<IDeletedIncomingMail>({
      original_id: mail.id,
      organization_id: mail.organization_id,
      accounting_object_id: mail.accounting_object_id ?? '',
      seq: mail.seq,
      number: mail.number ?? '',
      date: mail.date,
      sender_outgoing_number: mail.sender_outgoing_number ?? '',
      subject: mail.subject,
      sender: mail.sender,
      responsible: mail.responsible,
      responsible_name: mail.responsible_name ?? '',
      delivery_method: mail.delivery_method,
      comment: mail.comment ?? '',
      created_by: mail.created_by ?? '',
      created_by_name: mail.created_by_name ?? '',
      updated_by: mail.updated_by ?? '',
      updated_by_name: mail.updated_by_name ?? '',
      deleted_by: deletedBy,
      deleted_by_name: deletedByName,
      deleted_at: deletedAt,
    });

  await pb.collection(DELETED_MAIL_HISTORY_COLLECTION).create<IDeletedMailHistory>({
    deleted_incoming_mail_id: archived.id,
    organization_id: mail.organization_id,
    author: deletedBy,
    author_name: deletedByName,
    changed_at: deletedAt,
    previous_data: {
      deleted_by: deletedBy,
      deleted_by_name: deletedByName,
      deleted_at: deletedAt,
    },
    type: 'deleted',
  });

  return pb.collection(MAIL_INCOMING_COLLECTION).delete(id);
}

/** Outgoing twin of `deleteIncomingMail`. */
export async function deleteOutgoingMail(id: string) {
  const mail = await pb.collection(MAIL_OUTGOING_COLLECTION).getOne<IOutgoingMail>(id);
  const deletedBy = currentActorId();
  const deletedByName = currentActorName();
  const deletedAt = new Date().toISOString();

  const archived = await pb
    .collection(DELETED_MAIL_OUTGOING_COLLECTION)
    .create<IDeletedOutgoingMail>({
      original_id: mail.id,
      organization_id: mail.organization_id,
      accounting_object_id: mail.accounting_object_id ?? '',
      seq: mail.seq,
      outgoing_number: mail.outgoing_number,
      date: mail.date,
      counterparty_incoming_number: mail.counterparty_incoming_number ?? '',
      subject: mail.subject,
      recipient: mail.recipient,
      responsible: mail.responsible,
      responsible_name: mail.responsible_name ?? '',
      delivery_method: mail.delivery_method,
      comment: mail.comment ?? '',
      created_by: mail.created_by ?? '',
      created_by_name: mail.created_by_name ?? '',
      updated_by: mail.updated_by ?? '',
      updated_by_name: mail.updated_by_name ?? '',
      deleted_by: deletedBy,
      deleted_by_name: deletedByName,
      deleted_at: deletedAt,
    });

  await pb.collection(DELETED_MAIL_HISTORY_COLLECTION).create<IDeletedMailHistory>({
    deleted_outgoing_mail_id: archived.id,
    organization_id: mail.organization_id,
    author: deletedBy,
    author_name: deletedByName,
    changed_at: deletedAt,
    previous_data: {
      deleted_by: deletedBy,
      deleted_by_name: deletedByName,
      deleted_at: deletedAt,
    },
    type: 'deleted',
  });

  return pb.collection(MAIL_OUTGOING_COLLECTION).delete(id);
}

// --- Archive reads ---

/** Paginated archive of deleted incoming mails, most recently deleted first. */
export function getDeletedIncomingMails(
  params: MailListParams,
): Promise<ListResult<IDeletedIncomingMail>> {
  return pb
    .collection(DELETED_MAIL_INCOMING_COLLECTION)
    .getList<IDeletedIncomingMail>(params.page ?? 1, params.perPage ?? ARCHIVE_MAIL_PAGE_SIZE, {
      filter: buildDeletedIncomingMailFilter(params),
      sort: params.sort ?? ARCHIVE_SORT,
    });
}

/** Outgoing twin of `getDeletedIncomingMails`. */
export function getDeletedOutgoingMails(
  params: MailListParams,
): Promise<ListResult<IDeletedOutgoingMail>> {
  return pb
    .collection(DELETED_MAIL_OUTGOING_COLLECTION)
    .getList<IDeletedOutgoingMail>(params.page ?? 1, params.perPage ?? ARCHIVE_MAIL_PAGE_SIZE, {
      filter: buildDeletedOutgoingMailFilter(params),
      sort: params.sort ?? ARCHIVE_SORT,
    });
}

export function getDeletedIncomingMail(id: string) {
  return pb.collection(DELETED_MAIL_INCOMING_COLLECTION).getOne<IDeletedIncomingMail>(id);
}

export function getDeletedOutgoingMail(id: string) {
  return pb.collection(DELETED_MAIL_OUTGOING_COLLECTION).getOne<IDeletedOutgoingMail>(id);
}

// --- Restore ---

/**
 * Restores an archived incoming mail under its ORIGINAL id, then drops the
 * archive row together with its archive history and records a `restored` entry.
 *
 * Reusing `original_id` is mandatory here and has no invoice counterpart:
 * `mail_files.mail_id` is a plain text column, so a freshly generated id would
 * orphan every attachment. The invoice restore path can afford a new id only
 * because `deleted_invoice_files` snapshots the bytes and restoreDeletedInvoice
 * re-uploads them into the new invoice — mail has no file-archive collection and
 * deliberately needs none. Its `original_invoice_id`/`source_*` columns exist
 * only to preserve the copy chain, not the identity.
 */
export async function restoreDeletedIncomingMail(deletedMailId: string): Promise<IIncomingMail> {
  const deleted = await pb
    .collection(DELETED_MAIL_INCOMING_COLLECTION)
    .getOne<IDeletedIncomingMail>(deletedMailId);

  const restored = await pb.collection(MAIL_INCOMING_COLLECTION).create<IIncomingMail>({
    id: deleted.original_id,
    organization_id: deleted.organization_id,
    date: deleted.date,
    subject: deleted.subject,
    sender: deleted.sender,
    responsible: deleted.responsible,
    accounting_object_id: deleted.accounting_object_id ?? '',
    seq: deleted.seq,
    number: deleted.number ?? '',
    sender_outgoing_number: deleted.sender_outgoing_number ?? '',
    responsible_name: deleted.responsible_name ?? '',
    delivery_method: deleted.delivery_method,
    comment: deleted.comment ?? '',
    created_by: deleted.created_by ?? '',
    created_by_name: deleted.created_by_name ?? '',
    updated_by: currentActorId(),
    updated_by_name: currentActorName(),
  });

  const archiveHistory = await getDeletedIncomingMailHistory(deletedMailId);
  for (const entry of archiveHistory) {
    await createMailHistory({
      mailId: restored.id,
      mailType: 'incoming',
      organizationId: deleted.organization_id,
      previousData: entry.previous_data,
      type: entry.type,
    });
  }

  await createMailHistory({
    mailId: restored.id,
    mailType: 'incoming',
    organizationId: deleted.organization_id,
    previousData: {
      deleted_by: deleted.deleted_by,
      deleted_by_name: deleted.deleted_by_name,
      deleted_at: deleted.deleted_at,
    },
    type: 'restored',
  });

  await Promise.all(
    archiveHistory.map((entry) => pb.collection(DELETED_MAIL_HISTORY_COLLECTION).delete(entry.id)),
  );
  await pb.collection(DELETED_MAIL_INCOMING_COLLECTION).delete(deletedMailId);

  return restored;
}

/**
 * Outgoing twin of `restoreDeletedIncomingMail` — same original-id rule, same
 * reason: attachments reference the mail by plain text id.
 */
export async function restoreDeletedOutgoingMail(deletedMailId: string): Promise<IOutgoingMail> {
  const deleted = await pb
    .collection(DELETED_MAIL_OUTGOING_COLLECTION)
    .getOne<IDeletedOutgoingMail>(deletedMailId);

  const restored = await pb.collection(MAIL_OUTGOING_COLLECTION).create<IOutgoingMail>({
    id: deleted.original_id,
    organization_id: deleted.organization_id,
    date: deleted.date,
    subject: deleted.subject,
    recipient: deleted.recipient,
    responsible: deleted.responsible,
    outgoing_number: deleted.outgoing_number,
    accounting_object_id: deleted.accounting_object_id ?? '',
    seq: deleted.seq,
    counterparty_incoming_number: deleted.counterparty_incoming_number ?? '',
    responsible_name: deleted.responsible_name ?? '',
    delivery_method: deleted.delivery_method,
    comment: deleted.comment ?? '',
    created_by: deleted.created_by ?? '',
    created_by_name: deleted.created_by_name ?? '',
    updated_by: currentActorId(),
    updated_by_name: currentActorName(),
  });

  const archiveHistory = await getDeletedOutgoingMailHistory(deletedMailId);
  for (const entry of archiveHistory) {
    await createMailHistory({
      mailId: restored.id,
      mailType: 'outgoing',
      organizationId: deleted.organization_id,
      previousData: entry.previous_data,
      type: entry.type,
    });
  }

  await createMailHistory({
    mailId: restored.id,
    mailType: 'outgoing',
    organizationId: deleted.organization_id,
    previousData: {
      deleted_by: deleted.deleted_by,
      deleted_by_name: deleted.deleted_by_name,
      deleted_at: deleted.deleted_at,
    },
    type: 'restored',
  });

  await Promise.all(
    archiveHistory.map((entry) => pb.collection(DELETED_MAIL_HISTORY_COLLECTION).delete(entry.id)),
  );
  await pb.collection(DELETED_MAIL_OUTGOING_COLLECTION).delete(deletedMailId);

  return restored;
}

// --- Relations ---

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

// --- Attachments ---

/** Attachments of one mail, in upload order. Keyed by the polymorphic mail_id. */
export function getMailFiles(mailId: string, mailType: MailType) {
  return pb.collection(MAIL_FILES_COLLECTION).getFullList<IMailFile>({
    filter: `mail_id = "${qTag(mailId)}" && mail_type = "${mailType}"`,
    sort: 'created',
  });
}

/**
 * URL вложения. `pb.files.getURL` ждёт одно имя файла, а `mail_files.file` —
 * multiple-поле, поэтому берём первый элемент: `uploadMailFiles` создаёт по
 * одной записи на файл. `getURL` сам возвращает `''` на неполной записи, что
 * в `<Anchor href>` даёт битую ссылку, поэтому пустое приводим к `null`.
 */
export function getMailFileUrl(fileRecord: IMailFile): string | null {
  const filename = fileRecord.file?.[0];
  if (!filename) return null;
  return pb.files.getURL(fileRecord, filename) || null;
}

/**
 * Uploads attachments as one `mail_files` record per file. `name` is a single
 * text column while `file` allows up to 10 files, so batching several files
 * into one record has nowhere to put per-file names; the FormData field names
 * match createInvoiceFile's convention exactly.
 */
export async function uploadMailFiles(
  mailId: string,
  mailType: MailType,
  organizationId: string,
  files: File[],
) {
  const actorId = currentActorId();
  const actorName = currentActorName();
  return Promise.all(
    files.map((file) => {
      const formData = new FormData();
      formData.append('mail_id', mailId);
      formData.append('mail_type', mailType);
      formData.append('organization_id', organizationId);
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('created_by', actorId);
      formData.append('created_by_name', actorName);
      return pb.collection(MAIL_FILES_COLLECTION).create<IMailFile>(formData);
    }),
  );
}

export function deleteMailFile(id: string) {
  return pb.collection(MAIL_FILES_COLLECTION).delete(id);
}

// --- Permissions ---

/**
 * Writes the seven mail flags onto a membership. PocketBase's update is a
 * partial PATCH, so `role` and `objects` are left untouched — this does not go
 * through updateOrganizationUser because that signature has no room for the
 * flags, and widening it would change a function this task must not touch.
 */
export function updateOrganizationUserMailPermissions(
  orgUserId: string,
  permissions: MailPermissionFlags,
) {
  return pb
    .collection(ORGANIZATION_USERS_COLLECTION)
    .update<IOrganizationUser>(orgUserId, { ...permissions });
}
