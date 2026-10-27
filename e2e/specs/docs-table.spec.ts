import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, payInvoiceFull, findDocumentByMarker } from '../utils/pb';

const filePath = path.join(os.tmpdir(), `docs-table-${Date.now()}.txt`);

test.beforeAll(() => {
  fs.writeFileSync(filePath, 'файл для завершения документа');
});

test.afterAll(() => {
  fs.rmSync(filePath, { force: true });
});

test.describe('Документы: таблица и колонки', () => {
  test('настройка видимости колонок сохраняется, отработанные скрываются по умолчанию', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокТаблица');
    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    const document = await findDocumentByMarker(pb, marker);
    expect(document?.id).toBeTruthy();
    const documentId = document!.id as string;

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    await expect(page.locator(`tr[data-document-id="${documentId}"]`)).toBeVisible();

    await page.getByRole('button', { name: 'Настройка колонок' }).click();
    await page.getByRole('checkbox', { name: 'Контрагент' }).uncheck();
    await page.getByRole('button', { name: 'Сохранить' }).click();

    await page.reload();
    await expect(page.getByRole('columnheader', { name: 'Контрагент' })).toHaveCount(0);
    await expect(page.locator(`tr[data-document-id="${documentId}"]`)).toBeVisible();

    const row = page.locator(`tr[data-document-id="${documentId}"]`);
    await row.click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('tab', { name: 'Файлы' }).click();
    await page.setInputFiles('input[type="file"]', filePath);
    await modal.getByRole('button', { name: 'Загрузить' }).click();
    await expect(page.getByText('Файл загружен')).toBeVisible();

    await modal.getByRole('tab', { name: 'Документ' }).click();
    await modal.getByLabel('Подтверждён').click();
    await expect(page.getByText('Статус обновлён')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.locator(`tr[data-document-id="${documentId}"]`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Фильтр' }).click();
    await page.getByRole('menuitem', { name: 'Только отработанные' }).click();
    await expect(page.locator(`tr[data-document-id="${documentId}"]`)).toBeVisible();
    await page.getByRole('button', { name: 'Фильтр' }).click();
    await page.getByRole('menuitem', { name: 'Только отработанные' }).click();
    await expect(page.locator(`tr[data-document-id="${documentId}"]`)).toHaveCount(0);
  });
});
