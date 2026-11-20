import type { InvoiceColumnId } from '@/shared/types';
import type { OrgRole } from './invoice-field-access';

type NamedRole = Exclude<OrgRole, null>;

export const COLUMNS_BY_ROLE: Record<NamedRole, InvoiceColumnId[]> = {
  admin: [
    'counterparty',
    'purpose',
    'contract_no',
    'invoice_no',
    'amount',
    'paid',
    'paid_date',
    'comment',
    'files',
    'actions',
    'payment_mark',
    'initiator',
  ],
  moderator: [
    'counterparty',
    'purpose',
    'contract_no',
    'invoice_no',
    'amount',
    'paid',
    'paid_date',
    'comment',
    'files',
    'actions',
    'payment_mark',
    'initiator',
  ],
  user: [
    'counterparty',
    'purpose',
    'contract_no',
    'invoice_no',
    'amount',
    'paid',
    'paid_date',
    'actions',
    'comment',
    'files',
    'initiator',
  ],
  boss: [
    'counterparty',
    'purpose',
    'contract_no',
    'invoice_no',
    'amount',
    'paid',
    'paid_date',
    'comment',
    'files',
    'actions',
    'payment_mark',
    'initiator',
  ],
  guest: [
    'counterparty',
    'purpose',
    'contract_no',
    'invoice_no',
    'amount',
    'paid',
    'paid_date',
    'comment',
    'files',
    'initiator',
  ],
};

const EMPTY_COLUMNS: InvoiceColumnId[] = [];

export function getVisibleColumnsForRole(role: OrgRole): InvoiceColumnId[] {
  if (!role) return EMPTY_COLUMNS;
  return COLUMNS_BY_ROLE[role] ?? EMPTY_COLUMNS;
}

import { ALL_INVOICE_COLUMNS } from './invoice-columns';

export function getColumnSettingsItems(role: OrgRole) {
  const allowedIds = getVisibleColumnsForRole(role);
  return ALL_INVOICE_COLUMNS.filter((col) => allowedIds.includes(col.id));
}
