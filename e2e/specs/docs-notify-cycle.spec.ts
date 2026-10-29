import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, loginViaUi, logoutViaUi, uniqueMarker } from '../fixtures';
import { authAs, createInvoice } from '../utils/pb';

const filePath = path.join(os.tmpdir(), `docs-notify-cycle-${Date.now()}.txt`);

test.beforeAll(() => {
  fs.writeFileSync(filePath, 'тестовый вложенный файл документа');
});

test.afterAll(() => {
  fs.rmSync(filePath, { force: true });
});

test.describe('Уведомления: сквозной сценарий счёт → документ', () => {
  test('цикл уведомлений: счёт → документ → файл → подтверждение → отработан', async ({
    page,
    orgId,
    objectId,
  }) => {
    const marker = uniqueMarker('УведомЦикл');
    const today = new Date().toISOString().slice(0, 10);

    // === Шаг 1: заходим за пользователя ===
    await loginViaUi(page, 'user');
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('button', { name: 'Выйти' }).first()).toBeVisible();

    // === Шаг 2: создаём счёт от пользователя ===
    const pbUser = await authAs('user');
    const invoice = await createInvoice(pbUser, {
      orgId,
      objectId,
      counterparty: marker,
      amount: 1000,
    });
    const invoiceId = invoice.id as string;

    // === Шаг 3: заходим за админа ===
    await logoutViaUi(page);
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('button', { name: 'Выйти' }).first()).toBeVisible();

    // === Шаг 4: проверяем уведомление о созданном счёте у админа, переходим на счёт ===
    await page.getByRole('button', { name: /Уведомления/ }).click();
    const drawer = page.getByRole('dialog').filter({ hasText: 'Уведомления' });
    await expect(drawer).toBeVisible();
    await expect(page.getByText(`Создан счёт: ${marker}`)).toBeVisible();
    await page.getByText(`Создан счёт: ${marker}`).first().click();

    // === Шаг 5: админ помечает счёт оплаченным (сервер авто-создаёт документ + уведомление) ===
    const pbAdmin = await authAs('admin');
    await pbAdmin.collection('invoices').update(invoiceId, {
      paid: true,
      paid_amount: 0,
      paid_date: today,
    });

    // === Шаг 6: заходим за пользователя, проверяем уведомление о документе, переходим на документ ===
    await logoutViaUi(page);
    await loginViaUi(page, 'user');
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('button', { name: 'Выйти' }).first()).toBeVisible();

    await page.getByRole('button', { name: /Уведомления/ }).click();
    await expect(drawer).toBeVisible();
    await expect(page.getByText(`Создан документ: ${marker}`)).toBeVisible();
    await page.getByText(`Создан документ: ${marker}`).first().click();
    await page.waitForURL('**/docs');
    await expect(page.getByText('Документы')).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();

    // === Шаг 7: открываем документ, прикрепляем файл, замечаем изменение статуса ===
    const docRow = page.locator('tr').filter({ hasText: marker });
    await expect(docRow).toBeVisible();
    await docRow.click();

    const modal = page.getByRole('dialog');
    await modal.getByRole('tab', { name: 'Файлы' }).click();
    await page.setInputFiles('input[type="file"]', filePath);
    await modal.getByRole('button', { name: 'Загрузить' }).click();
    await expect(page.getByText('Файл загружен')).toBeVisible();

    await modal.getByRole('tab', { name: 'Документ' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Да', { exact: true })).toBeVisible();
    await page.reload();

    // === Шаг 8-9: заходим за админа, по уведомлению находим документ, помечаем принятым ===
    await logoutViaUi(page);
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('button', { name: 'Выйти' }).first()).toBeVisible();

    await page.getByRole('button', { name: /Уведомления/ }).click();
    await expect(drawer).toBeVisible();
    await expect(page.getByText(`Статус документа: ${marker}`)).toBeVisible();
    await page.getByText(`Статус документа: ${marker}`).first().click();
    await page.waitForURL('**/docs');
    await expect(page.getByText('Документы')).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();

    const adminDocRow = page.locator('tr').filter({ hasText: marker });
    await expect(adminDocRow).toBeVisible();
    await adminDocRow.click();

    const adminModal = page.getByRole('dialog');
    await adminModal.getByRole('tab', { name: 'Документ' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await adminModal.getByText('Подтверждён', { exact: true }).click();
    await expect(page.getByText('Статус обновлён')).toBeVisible();
    await page.reload();

    // === Шаг 10: заходим за пользователя, проверяем серый отработанный документ ===
    await logoutViaUi(page);
    await loginViaUi(page, 'user');
    await page.goto('http://localhost:5173/docs');
    await expect(page.getByText('Документы')).toBeVisible();

    const userDocRow = page.locator('tr').filter({ hasText: marker });
    await expect(userDocRow).toBeVisible();
    await userDocRow.click();

    const userModal = page.getByRole('dialog');
    await userModal.getByRole('tab', { name: 'Документ' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(userModal.getByText('Отработан')).toBeVisible();
  });
});
