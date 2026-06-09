import type {
  IOrganization,
  IBankAccount,
  IAccountingObject,
  IInvoice,
  IOrganizationUser,
  IUser,
  IInvoiceHistory,
  IPaymentMark,
  INotification,
  IBalanceHistory,
} from '@/shared/types';

export const org1: IOrganization = { id: 'org1', name: 'ООО "Тест"', color: '#228be6' };
export const org2: IOrganization = { id: 'org2', name: 'ООО "Демо"', color: '#40c057' };

export const adminUser: IUser = {
  id: 'admin1', email: 'admin@test.ru', login: 'admin', name: 'Админ',
  avatar: '', verified: true, created: '2025-01-01', updated: '2025-01-01',
};
export const userUser: IUser = {
  id: 'user1', email: 'user@test.ru', login: 'user', name: 'Пользователь',
  avatar: '', verified: true, created: '2025-01-01', updated: '2025-01-01',
};
export const guestUser: IUser = {
  id: 'guest1', email: 'guest@test.ru', login: 'guest', name: 'Гость',
  avatar: '', verified: true, created: '2025-01-01', updated: '2025-01-01',
};
export const bossUser: IUser = {
  id: 'boss1', email: 'boss@test.ru', login: 'boss', name: 'Босс',
  avatar: '', verified: true, created: '2025-01-01', updated: '2025-01-01',
};

export const bankAcc1: IBankAccount = { id: 'ba1', organization_id: 'org1', account_number: '4070281012345' };
export const bankAcc2: IBankAccount = { id: 'ba2', organization_id: 'org1', account_number: '4070281098765' };
export const bankAcc3: IBankAccount = { id: 'ba3', organization_id: 'org2', account_number: '4070281000001' };

export const balance1: IBalanceHistory = { id: 'bh1', account_id: 'ba1', date: '2026-06-03', balance: 150000 };
export const balance2: IBalanceHistory = { id: 'bh2', account_id: 'ba2', date: '2026-06-03', balance: 85000 };

export const accObj1: IAccountingObject = { id: 'ao1', organization_id: 'org1', name: 'Основная деятельность' };
export const accObj2: IAccountingObject = { id: 'ao2', organization_id: 'org1', name: 'Капитальные вложения' };
export const accObj3: IAccountingObject = { id: 'ao3', organization_id: 'org2', name: 'Операционная деятельность' };

export const invoice1: IInvoice = {
  id: 'inv1', organization_id: 'org1', accounting_object_id: 'ao1',
  date: '2026-06-01', seq: 1, counterparty: 'ООО "Контрагент А"',
  purpose: 'Оплата услуг', contract_no: 'Д-001', invoice_no: 'СФ-001',
  amount: 50000, paid: false, paid_amount: null, payment_amounts: [],
  paid_date: '', comment: '', copy_comments: {}, created_by: 'admin1', updated_by: 'admin1',
};
export const invoice2: IInvoice = {
  id: 'inv2', organization_id: 'org1', accounting_object_id: 'ao1',
  date: '2026-06-01', seq: 2, counterparty: 'ООО "Контрагент А"',
  purpose: 'Материалы', contract_no: 'Д-001', invoice_no: 'СФ-002',
  amount: 30000, paid: true, paid_amount: 30000, payment_amounts: [30000],
  paid_date: '2026-06-02', comment: '', copy_comments: {}, created_by: 'admin1', updated_by: 'admin1',
};
export const invoice3: IInvoice = {
  id: 'inv3', organization_id: 'org1', accounting_object_id: 'ao2',
  date: '2026-06-01', seq: 1, counterparty: 'ООО "Поставщик Б"',
  purpose: 'Ремонт', contract_no: 'Д-002', invoice_no: 'СФ-003',
  amount: 120000, paid: false, paid_amount: null, payment_amounts: [],
  paid_date: '', comment: 'Срочно', copy_comments: {}, created_by: 'admin1', updated_by: 'admin1',
};

export const history1: IInvoiceHistory = {
  id: 'h1', invoice_id: 'inv1', author: 'Админ',
  changed_at: '2026-06-02T10:00:00Z',
  previous_data: { amount: 40000 },
};

export const paymentMark1: IPaymentMark = {
  id: 'pm1', invoice_id: 'inv2', organization_id: 'org1',
  amount: 30000, comment: 'Оплата по счёту', created_by: 'admin1',
  created: '2026-06-02T10:00:00Z',
};

export const notification1: INotification = {
  id: 'notif1', organization_id: 'org1', user_id: 'admin1',
  invoice_id: 'inv1', type: 'invoice_created', event: 'created',
  message: 'Создан счёт №1', actor_name: 'Админ',
  read: false, created: '2026-06-02T10:00:00Z',
};
export const notification2: INotification = {
  id: 'notif2', organization_id: 'org1', user_id: 'admin1',
  invoice_id: 'inv2', type: 'payment_marked', event: 'payment_marked',
  message: 'Оплачен счёт №2', actor_name: 'Админ',
  read: true, created: '2026-06-02T11:00:00Z',
};

export const orgUserAdmin: IOrganizationUser = {
  id: 'ou1', user_id: 'admin1', organization_id: 'org1', role: 'admin', objects: [],
  expand: { user_id: adminUser, organization_id: org1 },
};
export const orgUserUser: IOrganizationUser = {
  id: 'ou2', user_id: 'user1', organization_id: 'org1', role: 'user', objects: ['ao1'],
  expand: { user_id: userUser, organization_id: org1 },
};
export const orgUserGuest: IOrganizationUser = {
  id: 'ou3', user_id: 'guest1', organization_id: 'org1', role: 'guest', objects: [],
  expand: { user_id: guestUser, organization_id: org1 },
};
export const orgUserBoss: IOrganizationUser = {
  id: 'ou4', user_id: 'boss1', organization_id: 'org1', role: 'boss', objects: [],
  expand: { user_id: bossUser, organization_id: org1 },
};

export const defaultSeed = {
  organizations: [org1, org2],
  bank_accounts: [bankAcc1, bankAcc2, bankAcc3],
  balance_history: [balance1, balance2],
  accounting_objects: [accObj1, accObj2, accObj3],
  invoices: [invoice1, invoice2, invoice3],
  invoice_history: [history1],
  payment_marks: [paymentMark1],
  users: [adminUser, userUser, guestUser, bossUser],
  organization_users: [orgUserAdmin, orgUserUser, orgUserGuest, orgUserBoss],
  user_settings: [],
  invoice_files: [],
  notifications: [notification1, notification2],
};
