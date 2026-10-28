import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, payInvoiceFull } from '../utils/pb';

const filePath = path.join(os.tmpdir(), `docs-human-flow-${Date.now()}.txt`);

test.beforeAll(() => {
  fs.writeFileSync(filePath, 'файл человеческого сценария');
});

test.afterAll(() => {
  fs.rmSync(filePath, { force: true });
});

test.describe('Документы: сквозной сценарий', () => {
  test('создание, файл, статус, комментарий, архив и восстановление', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокСквозной');
    const commentText = uniqueMarker('КомментСквозной');
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
    await modal.getByLabel('Подтверждён').click();
    await expect(page.getByText('Статус обновлён')).toBeVisible();

    await modal.getByRole('tab', { name: 'Комментарии' }).click();
    await modal.getByLabel('Новый комментарий').fill(commentText);
    await modal.getByRole('button', { name: 'Добавить комментарий' }).click();
    await expect(page.getByRole('alert').getByText('Комментарий добавлен')).toBeVisible();
    await expect(modal.getByText(commentText).first()).toBeVisible();

    await modal.getByRole('tab', { name: 'Документ' }).click();
    await modal.getByRole('button', { name: 'В архив' }).click();
    await page.getByLabel('Причина').fill('сквозная архивация');
    await page.getByRole('dialog', { name: 'Переместить документ в архив' }).getByRole('button', { name: 'В архив' }).click();
    await expect(page.getByText('Документ перемещён в архив')).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: marker })).toHaveCount(0);

    await page.goto('http://localhost:5173/admin');
    await page.getByRole('tab', { name: /Архив документов/ }).click();
    const archiveSearch = page.getByLabel('Поиск в архиве документов');
    await archiveSearch.fill(marker);
    const archiveRow = page.locator('tr').filter({ hasText: marker });
    await expect(archiveRow).toBeVisible();
    await expect(archiveRow).toContainText('сквозная архивация');

    await archiveRow.getByRole('button', { name: 'Восстановить документ' }).click();
    await page.getByRole('dialog', { name: 'Восстановление документа' }).getByRole('button', { name: 'Восстановить' }).click();
    await expect(page.getByText('Документ восстановлен')).toBeVisible();

    await page.goto('http://localhost:5173/docs');
    await page.getByRole('button', { name: 'Фильтр' }).click();
    await page.getByRole('menuitem', { name: 'Подтверждён' }).click();
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();
  });
});
