import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, payInvoiceFull } from '../utils/pb';

test.describe('Документы: архив', () => {
  test('удаление в архив и восстановление документа', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокАрхив');
    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    const row = page.locator('tr').filter({ hasText: marker });
    await expect(row).toBeVisible();
    await row.click();

    const modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: 'В архив' }).click();
    await page.getByLabel('Причина').fill('причина архивации');
    await page.getByRole('dialog', { name: 'Переместить документ в архив' }).getByRole('button', { name: 'В архив' }).click();
    await expect(page.getByText('Документ перемещён в архив')).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: marker })).toHaveCount(0);

    await page.goto('http://localhost:5173/admin');
    await page.getByRole('tab', { name: /Архив документов/ }).click();
    const archiveSearch = page.getByLabel('Поиск в архиве документов');
    await archiveSearch.fill(marker);
    const archiveRow = page.locator('tr').filter({ hasText: marker });
    await expect(archiveRow).toBeVisible();
    await expect(archiveRow).toContainText('причина архивации');

    await archiveRow.getByRole('button', { name: 'Восстановить' }).click();
    await page.getByRole('dialog', { name: 'Восстановление документа' }).getByRole('button', { name: 'Восстановить' }).click();
    await expect(page.getByText('Документ восстановлен')).toBeVisible();

    await page.goto('http://localhost:5173/docs');
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();
  });
});
