/** Типы банковских счетов и остатков по дням. */

export interface IBankAccount {
  id: string;
  organization_id: string;
  account_number: string;
}

export interface IBalanceHistory {
  id: string;
  account_id: string;
  date: string;
  balance: number;
}

export interface IAccountWithBalance {
  account: IBankAccount;
  balance: number;
}
