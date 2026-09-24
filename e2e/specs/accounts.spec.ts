import { test, expect, loginViaUi } from '../fixtures';

test.describe('Объекты учёта', () => {
  test('объект существует и в UI есть блок остатков', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173');
    await expect(page.getByText(/Итого|Остаток|Всего/).first()).toBeVisible();
  });
});
