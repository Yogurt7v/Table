import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, payInvoiceFull } from '../utils/pb';

test.describe('Документы: комментарии', () => {
  test('ответственный добавляет комментарий, а босс видит его только для чтения', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокКоммент');
    const commentText = uniqueMarker('Комментарий');
    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    const row = page.locator('tr').filter({ hasText: marker });
    await expect(row).toBeVisible();
    await row.click();

    const modal = page.getByRole('dialog');
    await modal.getByRole('tab', { name: 'Комментарии' }).click();
    await modal.getByLabel('Новый комментарий').fill(commentText);
    await modal.getByRole('button', { name: 'Добавить комментарий' }).click();
    await expect(page.getByRole('alert').getByText('Комментарий добавлен')).toBeVisible();
    await expect(modal.getByText(commentText, { exact: true }).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Выйти' }).click();

    await loginViaUi(page, 'boss');
    await page.goto('http://localhost:5173/docs');
    const bossRow = page.locator('tr').filter({ hasText: marker });
    await expect(bossRow).toBeVisible();
    await bossRow.click();
    const bossModal = page.getByRole('dialog');
    await bossModal.getByRole('tab', { name: 'Комментарии' }).click();
    await expect(bossModal.getByText(commentText).first()).toBeVisible();
    await expect(bossModal.getByLabel('Новый комментарий')).toHaveCount(0);
    await expect(bossModal.getByRole('button', { name: 'Добавить комментарий' })).toHaveCount(0);
  });
});
