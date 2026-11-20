/** Типы домена документов: документы, файлы, комментарии, история и параметры списка. */

export type DocumentCreationMode = 'auto' | 'manual';

export type DocumentHistoryType =
  | ''
  | 'document_created'
  | 'document_updated'
  | 'document_auto_created'
  | 'document_synced'
  | 'file_added'
  | 'file_removed'
  | 'comment_added'
  | 'comment_deleted'
  | 'status_changed'
  | 'responsible_changed'
  | 'object_changed'
  | 'document_archived'
  | 'document_restored'
  | 'payment_cancelled'
  | 'payment_resumed';

export interface IDocument {
  id: string;
  organization_id: string;
  accounting_object_id: string;
  seq: number;
  payment_date: string;
  counterparty: string;
  purpose: string;
  contract_no: string;
  invoice_no: string;
  amount: number;
  responsible_id: string;
  responsible_name?: string;
  created_by: string;
  created_by_name?: string;
  source_invoice_id?: string;
  source_invoice_no?: string;
  creation_mode: DocumentCreationMode;
  sync_locked: boolean;
  provided: boolean;
  confirmed: boolean;
  confirmed_file_id?: string;
  payment_cancelled: boolean;
  is_deleted: boolean;
  deleted_by?: string;
  deleted_by_name?: string;
  deleted_at?: string;
  deletion_reason?: string;
  created?: string;
  updated?: string;
}

export interface IDocumentFile {
  id: string;
  document_id: string;
  organization_id: string;
  file: string;
  name: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  created?: string;
}

export interface IDocumentComment {
  id: string;
  document_id: string;
  organization_id: string;
  author: string;
  author_name?: string;
  text: string;
  created?: string;
}

export interface IDocumentHistory {
  id: string;
  document_id: string;
  organization_id: string;
  author?: string;
  author_name?: string;
  changed_at: string;
  type: DocumentHistoryType;
  previous_data: Record<string, unknown>;
  created?: string;
}

export type DocumentColumnId =
  | 'seq'
  | 'payment_date'
  | 'counterparty'
  | 'purpose'
  | 'contract_no'
  | 'invoice_no'
  | 'amount'
  | 'responsible'
  | 'author'
  | 'provided'
  | 'confirmed'
  | 'files'
  | 'comments'
  | 'source_file';

export interface DocumentListParams {
  organizationId: string;
  role: 'admin' | 'moderator' | 'user' | 'guest' | 'boss';
  userId: string;
  includeDeleted?: boolean;
}

export interface DocumentSourceInfo {
  invoiceId: string;
  invoiceNo: string;
  counterparty: string;
  amount: number;
  files: Array<{ id: string; name: string; url: string }>;
  deleted: boolean;
}
