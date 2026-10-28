import PocketBase from 'pocketbase';
import { E2E_PASSWORD, E2E_USERS, ORGS } from '../data';
import type { TestRole } from '../types';

const PB_URL = process.env.E2E_PB_URL ?? 'http://127.0.0.1:8090';

export function pbAdmin(): PocketBase {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  return pb;
}

export function newClient(): PocketBase {
  return pbAdmin();
}

function rawLogin(role: TestRole): string {
  return E2E_USERS[role].login;
}

/**
 * Аутентифицирует API-клиент под указанной ролью. Возвращает клиент с
 * заполненным authStore (используется и как «главный» клиент сценария).
 */
export async function authAs(role: TestRole): Promise<PocketBase> {
  const pb = pbAdmin();
  await pb.collection('users').authWithPassword(rawLogin(role), E2E_PASSWORD);
  return pb;
}

// ── Базовые данные ──

export const TEST_ORG = ORGS.lenmetrostroy;

export async function resolveTestOrgId(_client: PocketBase): Promise<string> {
  return TEST_ORG.id;
}

export async function firstObjectId(client: PocketBase, orgId = TEST_ORG.id): Promise<string> {
  const list = await client
    .collection('accounting_objects')
    .getList(1, 1, { filter: `organization_id = "${orgId}"`, sort: 'created' });
  const item = list.items[0];
  if (!item) throw new Error('accounting_objects: пусто, тест не может выполняться');
  return item.id;
}

// ── Счета ──

export function qTag(v: string): string {
  return v.replace(/"/g, '\\"');
}

export function byCounterparty(marker: string): string {
  return `counterparty ~ "${qTag(marker)}"`;
}

export async function findInvoiceByMarker(
  client: PocketBase,
  marker: string,
): Promise<Record<string, unknown>> {
  const list = await client
    .collection('invoices')
    .getFullList({ filter: byCounterparty(marker), sort: '-created' });
  return list[0];
}

export interface CreateInvoiceData {
  orgId?: string;
  objectId?: string;
  date?: string;
  counterparty: string;
  purpose?: string;
  counterparty_no?: string;
  invoice_no?: string;
  amount: number;
  comment?: string;
}

/**
 * Создаёт счёт через API (без UI-формы). Возвращает нормализованный объект
 * счёта; seq и created_by/updated_by проставляет сервер.
 */
export async function createInvoice(
  client: PocketBase,
  data: CreateInvoiceData,
): Promise<Record<string, unknown>> {
  const orgId = data.orgId ?? TEST_ORG.id;
  const objectId = data.objectId ?? (await firstObjectId(client, orgId));
  const created = await client.collection('invoices').create({
    organization_id: orgId,
    accounting_object_id: objectId,
    date: data.date ?? todayIso(),
    counterparty: data.counterparty,
    purpose: data.purpose ?? 'Оплата по договору',
    counterparty_no: data.counterparty_no ?? '',
    invoice_no: data.invoice_no ?? '1',
    amount: data.amount,
    comment: data.comment ?? '',
  });
  return created as unknown as Record<string, unknown>;
}

export async function getInvoice(
  client: PocketBase,
  invoiceId: string,
): Promise<Record<string, unknown>> {
  return client.collection('invoices').getOne(invoiceId) as unknown as Promise<
    Record<string, unknown>
  >;
}

export async function payInvoiceFull(invoiceId: string, dateIso: string, _actorName = 'Имя') {
  const pb = pbAdmin();
  await pb.collection('invoices').update(invoiceId, {
    paid: true,
    paid_amount: 0,
    paid_date: dateIso,
  });
}

export async function createPaymentMark({
  invoiceId,
  status,
  amount,
  comment,
}: {
  invoiceId: string;
  status: 'proposed' | 'approved' | 'partial';
  amount?: number;
  comment?: string;
}) {
  const pb = pbAdmin();
  const invoice = await getInvoice(pb, invoiceId);
  const orgId = invoice.organization_id as string;
  await pb.collection('payment_marks').create({
    invoice_id: invoiceId,
    organization_id: orgId,
    status,
    amount: amount ?? null,
    comment: comment ?? '',
  });
}

export function getPaymentMarks(invoiceId: string) {
  return pbAdmin()
    .collection('payment_marks')
    .getFullList({ filter: `invoice_id = "${invoiceId}"` });
}

export function getModifiedCopies(invoiceId: string) {
  const invNo = invoiceId;
  return pbAdmin()
    .collection('invoices')
    .getFullList({ filter: `original_invoice_id = "${invNo}"` });
}

// Удаление с архивацией: создаёт запись в deleted_invoices и удаляет оригинал
// (повторяет фронтенд-flow deleteInvoice из src/api/collections.ts).
export async function deleteInvoiceSoft(client: PocketBase, invoiceId: string): Promise<void> {
  const invoice = await client.collection('invoices').getOne(invoiceId);
  await client.collection('deleted_invoices').create({
    original_id: invoice.id,
    organization_id: invoice.organization_id,
    accounting_object_id: invoice.accounting_object_id,
    date: invoice.date,
    seq: invoice.seq,
    counterparty: invoice.counterparty,
    purpose: invoice.purpose,
    contract_no: invoice.contract_no,
    invoice_no: invoice.invoice_no,
    amount: invoice.amount,
    paid: invoice.paid,
    paid_date: invoice.paid_date,
    paid_amount: invoice.paid_amount,
    payment_amounts: invoice.payment_amounts,
    comment: invoice.comment,
    copy_comments: invoice.copy_comments,
    created_by: invoice.created_by,
    updated_by: invoice.updated_by,
    created_by_name: invoice.created_by_name || '',
    updated_by_name: invoice.updated_by_name || '',
    original_invoice_id: invoice.original_invoice_id || '',
    source_paid_amount: invoice.source_paid_amount,
    source_paid_date: invoice.source_paid_date,
    source_created: invoice.source_created,
    deleted_by: client.authStore.model?.id ?? '',
    deleted_by_name: client.authStore.model?.name || client.authStore.model?.email || '',
    deleted_at: new Date().toISOString(),
  });
  await client.collection('invoices').delete(invoiceId);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Документы ──

export async function findDocumentByMarker(
  client: PocketBase,
  marker: string,
): Promise<Record<string, unknown> | undefined> {
  const list = await client
    .collection('documents')
    .getFullList({ filter: byCounterparty(marker), sort: '-created' });
  return list[0] as unknown as Record<string, unknown> | undefined;
}

export async function findArchivedDocumentByMarker(
  client: PocketBase,
  marker: string,
): Promise<Record<string, unknown> | undefined> {
  const list = await client
    .collection('documents')
    .getFullList({ filter: `${byCounterparty(marker)} && is_deleted = true`, sort: '-deleted_at' });
  return list[0] as unknown as Record<string, unknown> | undefined;
}

export async function cancelInvoicePayment(invoiceId: string): Promise<void> {
  const pb = pbAdmin();
  return pb.collection('invoices').update(invoiceId, { paid: false });
}

// ── Документы ──

export async function createDocumentManually(
  client: PocketBase,
  data: {
    orgId: string;
    objectId: string;
    paymentDate: string;
    counterparty: string;
    purpose?: string;
    contractNo?: string;
    invoiceNo?: string;
    amount?: number;
    responsibleId: string;
    responsibleName?: string;
    sourceInvoiceId?: string;
    sourceInvoiceNo?: string;
  },
): Promise<Record<string, unknown>> {
  const existing = await client.collection('documents').getFullList({
    filter: `accounting_object_id = "${qTag(data.objectId)}"`,
    sort: '-seq',
    fields: 'seq',
  });
  const maxSeq = Number(existing[0]?.seq ?? 0);
  const actorId = client.authStore.model?.id ?? '';
  return client.collection('documents').create({
    organization_id: data.orgId,
    accounting_object_id: data.objectId,
    seq: maxSeq + 1,
    payment_date: data.paymentDate,
    counterparty: data.counterparty,
    purpose: data.purpose ?? '',
    contract_no: data.contractNo ?? '',
    invoice_no: data.invoiceNo ?? '',
    amount: data.amount ?? 0,
    responsible_id: data.responsibleId,
    responsible_name: data.responsibleName ?? '',
    created_by: actorId,
    created_by_name: data.responsibleName ?? '',
    creation_mode: 'manual',
    sync_locked: true,
    provided: false,
    confirmed: false,
    payment_cancelled: false,
    is_deleted: false,
    source_invoice_id: data.sourceInvoiceId ?? '',
    source_invoice_no: data.sourceInvoiceNo ?? '',
  });
}

export async function archiveDocument(
  client: PocketBase,
  documentId: string,
  reason: string,
): Promise<Record<string, unknown>> {
  return client.collection('documents').update(documentId, {
    is_deleted: true,
    deleted_by: client.authStore.model?.id ?? '',
    deleted_by_name: client.authStore.model?.name || client.authStore.model?.email || '',
    deleted_at: new Date().toISOString(),
    deletion_reason: reason,
  });
}

export async function restoreDocument(
  client: PocketBase,
  documentId: string,
  orgId: string,
  objectId: string,
): Promise<Record<string, unknown>> {
  const list = await client.collection('documents').getFullList({
    filter: `organization_id = "${orgId}" && accounting_object_id = "${objectId}"`,
    fields: 'seq',
  });
  const maxSeq = list.reduce((max, doc) => Math.max(max, Number(doc.seq) || 0), 0);
  return client.collection('documents').update(documentId, {
    is_deleted: false,
    deleted_by: '',
    deleted_by_name: '',
    deleted_at: '',
    deletion_reason: '',
    seq: maxSeq + 1,
  });
}

export async function addDocumentComment(
  client: PocketBase,
  documentId: string,
  orgId: string,
  text: string,
): Promise<Record<string, unknown>> {
  return client.collection('document_comments').create({
    document_id: documentId,
    organization_id: orgId,
    author: client.authStore.model?.id ?? '',
    author_name: client.authStore.model?.name || client.authStore.model?.email || '',
    text,
  });
}
