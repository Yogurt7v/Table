import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { TestRole } from '../types';
import { E2E_USERS, E2E_PASSWORD } from '../data';

export const APP = 'http://localhost:5173/';

/**
 * Вход через форму логина. Роль — из data.ts; селекторы сверены с LoginPage.
 */
export async function loginViaUi(page: Page, role: string) {
  const creds = E2E_USERS[role as TestRole];
  const login: string = creds?.login ?? role;
  const password: string = creds?.password ?? E2E_PASSWORD;
  if (password === undefined) {
    const u = E2E_USERS[login as TestRole];
    if (u) {
      login = u.login;
      password = u.password;
    }
  }
  await page.goto(`${APP}login`);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('button', { name: 'Выйти' }).first()).toBeVisible();
}

/**
 * Открывает реестр счетов и ждёт таблицу (заголовок вкладки «Счета»).
 */
export async function openRegistry(page: Page) {
  await page.goto(APP);
  await expect(page.getByRole('heading', { name: 'Счета' })).toBeVisible({ timeout: 15000 });
}

/**
 * Добавление счёта инлайн-формой (пустая строка-драфт реестра).
 * Открывает «Добавить счёт», вводит контрагента/сумму и сохраняет.
 */
export async function createInvoiceViaUi(
  page: Page,
  data: { varCounterparty: string; amount: string; purpose?: string },
) {
  await page.getByRole('button', { name: 'Добавить счёт' }).first().click();
  await page.getByPlaceholder('Контрагент').fill(data.varCounterparty);
  await page.getByPlaceholder('Сумма').fill(data.amount);
  if (data.purpose) await page.getByPlaceholder('Назначение').fill(data.purpose);
  await page.getByRole('button', { name: 'Сохранить счёт' }).first().click();
  await expect(page.getByText('Счёт добавлен')).toBeVisible();
}

/** Выход через шапку (админ-меню → «Выйти»). */
export async function logoutViaUi(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Выйти" }).click();
}
