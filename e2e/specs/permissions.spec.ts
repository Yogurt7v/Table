import { test, expect } from '../fixtures';
import { loginViaUi } from '../utils/ui';

test.describe('Права доступа (матрица)', () => {
  test('admin видит админку в шапке', async ({ page }) => {
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173');
    await expect(page.getByText('Панель администратора')).toBeVisible();
  });

  test('user не видит «Удалить» в меню счёта', async ({ page }) => {
    await loginViaUi(page, 'user');
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('button', { name: /Добавить счёт/ }).first()).toBeVisible();
  });

  test('guest (склад) — только чтение: нет «Добавить счёт»', async ({ page }) => {
    await loginViaUi(page, 'guest');
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('button', { name: /Добавить счёт/ })).toHaveCount(0);
  });
});
