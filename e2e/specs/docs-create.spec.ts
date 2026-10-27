import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, payInvoiceFull } from '../utils/pb';

test.describe('Документы: создание', () => {
  test('оплата счёта автоматически создаёт документ', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокАвто');
    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    await expect(page.getByRole('heading', { name: 'Документы' })).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();
  });

  test('администратор создаёт ручной документ', async ({ page }) => {
    const marker = uniqueMarker('ДокРуч');
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    await page.getByRole('button', { name: 'Добавить документ' }).click();

    const modal = page.getByRole('dialog');
    await modal.getByLabel('Объект').click();
    await page.getByRole('option').first().click();
    await modal.getByLabel('Контрагент').fill(marker);
    await modal.getByRole('button', { name: 'Создать документ' }).click();

    await expect(page.getByText('Документ создан')).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();
  });
});
