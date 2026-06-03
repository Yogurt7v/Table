import type {
  IAccountingObject,
  IBankAccount,
  IBalanceHistory,
  IInvoice,
  IInvoiceFile,
  IInvoiceHistory,
  INotification,
  IOrganization,
  IOrganizationUser,
  IPaymentMark,
  IUser,
  IUserSetting,
} from '@/shared/types';

interface Collections {
  organizations: Map<string, IOrganization>;
  bank_accounts: Map<string, IBankAccount>;
  balance_history: Map<string, IBalanceHistory>;
  accounting_objects: Map<string, IAccountingObject>;
  invoices: Map<string, IInvoice>;
  invoice_history: Map<string, IInvoiceHistory>;
  payment_marks: Map<string, IPaymentMark>;
  users: Map<string, IUser>;
  organization_users: Map<string, IOrganizationUser>;
  user_settings: Map<string, IUserSetting>;
  invoice_files: Map<string, IInvoiceFile>;
  notifications: Map<string, INotification>;
}

function createStore<T extends { id: string }>() {
  const map = new Map<string, T>();
  return {
    all: () => Array.from(map.values()),
    get: (id: string) => map.get(id),
    set: (item: T) => { map.set(item.id, item); return item; },
    delete: (id: string) => map.delete(id),
    clear: () => map.clear(),
    entries: () => Array.from(map.entries()).map(([, v]) => v),
  };
}

export function createDB(seed?: Partial<Collections>) {
  const organizations = createStore<IOrganization>();
  const bank_accounts = createStore<IBankAccount>();
  const balance_history = createStore<IBalanceHistory>();
  const accounting_objects = createStore<IAccountingObject>();
  const invoices = createStore<IInvoice>();
  const invoice_history = createStore<IInvoiceHistory>();
  const payment_marks = createStore<IPaymentMark>();
  const users = createStore<IUser>();
  const organization_users = createStore<IOrganizationUser>();
  const user_settings = createStore<IUserSetting>();
  const invoice_files = createStore<IInvoiceFile>();
  const notifications = createStore<INotification>();

  function init(data: NonNullable<typeof seed>) {
    data.organizations?.forEach(o => organizations.set(o));
    data.bank_accounts?.forEach(b => bank_accounts.set(b));
    data.balance_history?.forEach(h => balance_history.set(h));
    data.accounting_objects?.forEach(o => accounting_objects.set(o));
    data.invoices?.forEach(i => invoices.set(i));
    data.invoice_history?.forEach(h => invoice_history.set(h));
    data.payment_marks?.forEach(p => payment_marks.set(p));
    data.users?.forEach(u => users.set(u));
    data.organization_users?.forEach(o => organization_users.set(o));
    data.user_settings?.forEach(s => user_settings.set(s));
    data.invoice_files?.forEach(f => invoice_files.set(f));
    data.notifications?.forEach(n => notifications.set(n));
  }

  if (seed) init(seed);

  return {
    collections: {
      organizations,
      bank_accounts,
      balance_history,
      accounting_objects,
      invoices,
      invoice_history,
      payment_marks,
      users,
      organization_users,
      user_settings,
      invoice_files,
      notifications,
    } as Collections,
    init,
    clear() {
      for (const store of Object.values(this.collections)) {
        store.clear();
      }
    },
  };
}

export type DB = ReturnType<typeof createDB>;
