import type { DB } from '@/mocks/db';
import { createCrudHandlers } from './utils';
import { createAuthHandlers } from './auth';

export function createHandlers(db: DB) {
  return [
    ...createCrudHandlers(db, 'organizations' as const),
    ...createCrudHandlers(db, 'bank_accounts' as const),
    ...createCrudHandlers(db, 'balance_history' as const),
    ...createCrudHandlers(db, 'accounting_objects' as const),
    ...createCrudHandlers(db, 'invoices' as const),
    ...createCrudHandlers(db, 'invoice_history' as const),
    ...createCrudHandlers(db, 'organization_users' as const),
    ...createCrudHandlers(db, 'payment_marks' as const),
    ...createCrudHandlers(db, 'user_settings' as const),
    ...createCrudHandlers(db, 'invoice_files' as const),
    ...createCrudHandlers(db, 'notifications' as const),
    ...createAuthHandlers(db),
  ];
}
