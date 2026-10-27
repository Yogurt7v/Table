import { test, expect, loginViaUi, logoutViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, payInvoiceFull } from '../utils/pb';

test.describe('Документы: права доступа', () => {
  test('admin видит все, user только свои, boss читает, guest не видит раздел', async ({ page }) => {
    const adminPb = await authAs('admin');
    const userPb = await authAs('user');
    const orgId = await resolveTestOrgId(adminPb);
    const objectId = await firstObjectId(adminPb, orgId);
    const today = new Date().toISOString().slice(0, 10);
    const userMarker = uniqueMarker('ДокПользователь');
    const adminMarker = uniqueMarker('ДокАдмин');

    const userInvoice = await createInvoice(userPb, { orgId, objectId, counterparty: userMarker, amount: 1000 });
    await payInvoiceFull(userInvoice.id as string, today);
    const adminInvoice = await createInvoice(adminPb, { orgId, objectId, counterparty: adminMarker, amount: 2000 });
    await payInvoiceFull(adminInvoice.id as string, today);

    await loginViaUi(page, 'user');
    await page.goto('http://localhost:5173/docs');
    await expect(page.locator('tr').filter({ hasText: userMarker })).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: adminMarker })).toHaveCount(0);
    await logoutViaUi(page);

    await loginViaUi(page, 'boss');
    await page.goto('http://localhost:5173/docs');
    await expect(page.locator('tr').filter({ hasText: userMarker })).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: adminMarker })).toBeVisible();
    await page.locator('tr').filter({ hasText: userMarker }).click();
    const bossModal = page.getByRole('dialog');
    await expect(bossModal.getByRole('button', { name: 'Редактировать' })).toHaveCount(0);
    await expect(bossModal.getByRole('button', { name: 'В архив' })).toHaveCount(0);
    await expect(bossModal.getByLabel('Новый комментарий')).toHaveCount(0);
    await expect(bossModal.getByRole('button', { name: 'Добавить комментарий' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await logoutViaUi(page);

    await loginViaUi(page, 'guest');
    await page.goto('http://localhost:5173/docs');
    await expect(page.getByText('Доступ запрещён')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Документы' })).toHaveCount(0);
    await logoutViaUi(page);

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    await expect(page.locator('tr').filter({ hasText: userMarker })).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: adminMarker })).toBeVisible();
  });
});
