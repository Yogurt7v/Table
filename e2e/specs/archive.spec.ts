import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice, deleteInvoiceSoft } from '../utils/pb';

test.describe('Архив счетов', () => {
  test('удалённый счёт появляется в архиве и восстанавливается', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('Архив');
    const inv = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 10 });
    await deleteInvoiceSoft(pb, inv.id);

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/admin');
    await page.getByRole('tab', { name: /Архив счетов/ }).click();
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();
  });
});

