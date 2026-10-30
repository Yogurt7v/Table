import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, payInvoiceFull, cancelInvoicePayment } from '../utils/pb';

const filePath = path.join(os.tmpdir(), `docs-cancel-${Date.now()}.txt`);

test.beforeAll(() => {
  fs.writeFileSync(filePath, 'файл для отмены оплаты');
});

test.afterAll(() => {
  fs.rmSync(filePath, { force: true });
});

test.describe('Документы: отмена оплаты', () => {
  test('чистый документ уходит в архив при отмене и создаётся новый при повторной оплате', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокОтмена');
    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    const row = page.locator('tr').filter({ hasText: marker });
    await expect(row).toBeVisible();

    await cancelInvoicePayment(invoice.id as string);
    await page.reload();
    await expect(page.locator('tr').filter({ hasText: marker })).toHaveCount(0);


  });

  test('документ с активностью остаётся с флагом отмены и восстанавливает статус после возобновления', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокОтменаФлаг');
    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    const row = page.locator('tr').filter({ hasText: marker });
    await expect(row).toBeVisible();
    await row.click();

    const modal = page.getByRole('dialog');
    await modal.getByRole('tab', { name: 'Файлы' }).click();
    await page.setInputFiles('input[type="file"]', filePath);
    await modal.getByRole('button', { name: 'Загрузить' }).click();
    await expect(page.getByText('Файл загружен')).toBeVisible();

    await modal.getByRole('tab', { name: 'Документ' }).click();
    await modal.getByRole('button', { name: 'Отменить оплату' }).click();
    await expect(page.getByRole('alert').getByText('Оплата отменена')).toBeVisible();
    await expect(modal.getByText('Оплата отменена')).toBeVisible();
    await expect(modal.getByText('Предоставлен', { exact: true }).first()).toBeVisible();
    await expect(modal.getByText('Подтверждён', { exact: true }).first()).toBeVisible();

    await modal.getByRole('button', { name: 'Возобновить оплату' }).click();
    await expect(page.getByText('Оплата возобновлена')).toBeVisible();
    await expect(modal.getByText('Оплата отменена')).toHaveCount(0);
  });
});
