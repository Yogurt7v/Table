import { test, expect } from '../fixtures';
import { loginViaUi } from '../utils/ui';

test.describe('Администрирование', () => {
  test('вкладки админки доступны admin', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/admin');
    await expect(page.getByRole('tab', { name: /Организации/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Пользователи/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Архив счетов/ })).toBeVisible();
  });

  test('user не имеет доступа к /admin', async ({ page }) => {
    await loginViaUi(page, 'user');
    await page.goto('http://localhost:5173/admin');
    await expect(page.getByText(/Доступ запрещён|нет доступа/i).first()).toBeVisible();
  });
});
