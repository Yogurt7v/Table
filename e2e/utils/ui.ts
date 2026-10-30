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
  await page.getByRole('button', { name: 'Выйти' }).click();
}

/** Открывает реестр документов и ждёт заголовок «Документы». */
export async function openDocumentsPage(page: Page) {
  await page.goto(`${APP}docs`);
  await expect(page.getByText('Документы')).toBeVisible({ timeout: 15000 });
}

/** Открывает карточку документа по маркеру контрагента в строке таблицы. */
export async function openDocumentCard(page: Page, marker: string) {
  const row = page.locator('tr').filter({ hasText: marker });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/** Загружает файл в карточке документа (вкладка «Файлы»). */
export async function uploadDocumentFile(page: Page, filePath: string) {
  const modal = page.getByRole('dialog');
  await modal.getByRole('tab', { name: 'Файлы' }).click();
  await page.setInputFiles('input[type="file"]', filePath);
  await modal.getByRole('button', { name: 'Загрузить' }).click();
  await expect(page.getByText('Файл загружен')).toBeVisible();
}

/** Переключает статус документа в карточке (вкладка «Документ»). */
export async function toggleDocumentStatus(page: Page, statusName: 'Предоставлен' | 'Подтверждён') {
  const modal = page.getByRole('dialog');
  await modal.getByRole('tab', { name: 'Документ' }).click();
  await modal.getByLabel(statusName).click();
  await expect(page.getByText('Статус обновлён')).toBeVisible();
}

/** Переносит документ в другой объект (вкладка «Документ», поле «Объект»). */
export async function moveDocumentToObject(page: Page, objectName: string) {
  const modal = page.getByRole('dialog');
  await modal.getByRole('tab', { name: 'Документ' }).click();
  await modal.getByLabel('Объект').click();
  await page.getByRole('option', { name: objectName }).click();
  await modal.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Документ сохранён')).toBeVisible();
}
