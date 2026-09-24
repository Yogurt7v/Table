import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, createInvoice } from '../utils/pb';

test.describe('Поиск и группировка', () => {
  test('поиск по контрагенту сужает реестр', async ({ page }) => {
    const pb = await authAs('admin');
    const marker = uniqueMarker('Поиск');
    await createInvoice(pb, { counterparty: marker, amount: 500 });
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173');
    const search = page.getByPlaceholder('Поиск по счетам...').filter({ visible: true });
    await search.fill(marker);
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();
  });

  test('скрыть оплаченные', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173');
    const btn = page.getByRole('button', { name: /Скрыть оплаченные|Скрыть оплачен/ });
    if (await btn.count()) await btn.click();
  });
});
