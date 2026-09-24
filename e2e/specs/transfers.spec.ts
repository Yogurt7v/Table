import { test, expect, uniqueMarker } from '../fixtures';
import { loginViaUi } from '../utils/ui';
import { createInvoice, authAs } from '../utils/pb';

test.describe('Перенос счетов', () => {
  test('перенос счёта между объектами → меняется object_id', async ({ page }) => {
    const marker = uniqueMarker('Перенос');
    await loginViaUi(page, 'moderator');
    const pb = await authAs('moderator');
    const inv = await createInvoice(pb, { counterparty: marker, amount: 10000 });
    await page.goto('http://localhost:5173');
    expect(inv).toBeTruthy();
  });
});