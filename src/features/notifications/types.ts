/** Типы домена уведомлений. */

export interface INotification {
  id: string;
  organization_id: string;
  user_id: string;
  invoice_id: string;
  document_id?: string;
  type:
    | 'invoice_created'
    | 'invoice_updated'
    | 'payment_marked'
    | 'invoice_restored'
    | 'invoice_deleted'
    | 'document_created'
    | 'document_assigned'
    | 'document_status'
    | 'document_moved'
    | 'document_archived'
    | 'document_restored'
    | 'document_payment_cancelled'
    | 'document_comment_added'
    | 'document_comment_deleted';
  event: string;
  message: string;
  actor_name: string;
  object_name?: string;
  amount?: number;
  paid?: boolean;
  invoice_date?: string;
  read: boolean;
  created: string;
}
