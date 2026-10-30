import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, payInvoiceFull } from '../utils/pb';

const filePath = path.join(os.tmpdir(), `docs-status-${Date.now()}.txt`);

test.beforeAll(() => {
  fs.writeFileSync(filePath, 'тестовый файл документа');
});

test.afterAll(() => {
  fs.rmSync(filePath, { force: true });
});

test.describe('Документы: статусы и файлы', () => {
  test('загрузка файла включает «Предоставлен», подтверждение и удаление файла сбрасывает статусы', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокСтатус');
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
    await expect(modal.getByText('Предоставлен', { exact: true }).first()).toBeVisible();

    await modal.getByText('Подтверждён', { exact: true }).first().click();
    await expect(page.getByText('Статус обновлён')).toBeVisible();
    await expect(modal.getByText('Подтверждён', { exact: true }).first()).toBeVisible();

    await modal.getByRole('tab', { name: 'Файлы' }).click();
    await modal.getByRole('button', { name: 'Удалить файл' }).click();
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();
    await expect(page.getByRole('alert').getByText('Файл удалён')).toBeVisible();
    await expect(modal.getByText('Предоставлен', { exact: true }).first()).toBeVisible();
    await expect(modal.getByText('Подтверждён', { exact: true }).first()).toBeVisible();
    await expect(modal.getByText('Нет', { exact: true }).last()).toBeVisible();
  });
});
