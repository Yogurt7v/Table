import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, payInvoiceFull } from '../utils/pb';

test.describe('Документы: поиск', () => {
  test('поиск по реквизитам и комментариям', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокПоиск');
    const commentText = uniqueMarker('КомментПоиск');
    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000, purpose: 'назначение поиска' });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    const search = page.getByPlaceholder('Поиск по документам и комментариям');
    await search.fill(marker);
    await search.press('Enter');
    await page.waitForTimeout(600);
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();

    await page.getByRole('button', { name: 'Очистить поиск' }).click();
    await expect(search).toHaveValue('');
    await page.waitForTimeout(600);
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();

    const row = page.locator('tr').filter({ hasText: marker });
    await row.click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('tab', { name: 'Комментарии' }).click();
    await modal.getByLabel('Новый комментарий').fill(commentText);
    await modal.getByRole('button', { name: 'Добавить комментарий' }).click();
    await expect(page.getByRole('alert').getByText('Комментарий добавлен')).toBeVisible();
    await page.keyboard.press('Escape');

    await search.fill(commentText);
    await search.press('Enter');
    await page.waitForTimeout(600);
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();

    await page.getByRole('button', { name: 'Очистить поиск' }).click();
    await expect(search).toHaveValue('');
    await page.waitForTimeout(600);
  });
});
