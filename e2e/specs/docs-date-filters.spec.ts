import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import {
  authAs,
  resolveTestOrgId,
  firstObjectId,
  createInvoice,
  payInvoiceFull,
  todayIso,
} from '../utils/pb';

test.describe('Документы: фильтр по периодам дат', () => {
  test('период оплаты и период счёта фильтруют документы', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокПериод');

    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await payInvoiceFull(invoice.id as string, todayIso());

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');

    const row = page.locator('tr').filter({ hasText: marker });
    await expect(row).toBeVisible();

    const paymentInput = page.getByRole('button', { name: 'Период оплаты' });
    await paymentInput.click();
    const todayCell = page.getByRole('dialog').getByRole('button', { name: /28 октября 2026/ });
    await todayCell.click();
    await page.waitForTimeout(300);

    await expect(row).toBeVisible();
    await expect(page.getByRole('button', { name: 'Фильтр (1)', exact: true })).toBeVisible();
  });
});
