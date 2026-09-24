import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice } from '../utils/pb';

test.describe('Оплата счетов', () => {
  test('полная оплата (moderator) → paid + статус в UI', async ({ page }) => {
    const pb = await authAs('moderator');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('Оплата полн');
    const inv = await createInvoice(pb, {
      orgId, objectId, counterparty: marker, amount: 50_000,
    });
    await loginViaUi(page, 'moderator');
    await page.goto('http://localhost:5173');
    const row = page.locator('tr').filter({ hasText: marker });
    await row.getByRole('button', { name: 'Оплатить' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Оплатить' }).first().click();
    await expect(page.getByText('Статус счёта обновлён')).toBeVisible();

    const full = await pb.collection('invoices').getOne(inv.id as string);
    expect(full.paid).toBe(true);
  });
});
