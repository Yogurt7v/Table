import { pb } from './client.ts';
import type { IOrganization, IBankAccount, IAccountingObject, IInvoice } from '@/shared/types';

export function getOrganizations() {
  return pb.collection('organizations').getFullList<IOrganization>();
}

export function getBankAccounts(orgId: string) {
  return pb
    .collection('bank_accounts')
    .getFullList<IBankAccount>({ filter: `organization_id = "${orgId}"` });
}

export function getAccountingObjects(orgId: string) {
  return pb
    .collection('accounting_objects')
    .getFullList<IAccountingObject>({ filter: `organization_id = "${orgId}"` });
}

export function getInvoices(orgId: string, date: string) {
  return pb
    .collection('invoices')
    .getFullList<IInvoice>({
      filter: `organization_id = "${orgId}" && date = "${date}"`,
      sort: 'seq',
    });
}
