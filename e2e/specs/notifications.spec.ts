import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, createInvoice } from '../utils/pb';

test.describe('Уведомления', () => {
  test('после создания счёта moderator видит уведомление «Прочитать все»', async ({ page }) => {
    const pb = await authAs('admin');
    const marker = uniqueMarker('Уведомл');
    await createInvoice(pb, { counterparty: marker, amount: 300 });
    await loginViaUi(page, 'moderator');
    await page.goto('http://localhost:5173');
    const bell = page.getByRole('button', { name: /Уведомления/ });
    await bell.click();
    await expect(page.getByRole('button', { name: /Прочитать все/ })).toBeVisible();
  });
});
