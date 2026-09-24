import { test, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, createInvoice } from '../utils/pb';

test.describe('Файлы счёта', () => {
  test('загрузка файла в модалку файлов', async ({ page }) => {
    const pb = await authAs('admin');
    const marker = uniqueMarker('Файл');
    await createInvoice(pb, { counterparty: marker, amount: 15 });
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173');
    const row = page.locator('tr').filter({ hasText: marker });
    await row.getByRole('button', { name: /Файлы|Действия/ }).first().click();
  });
});
