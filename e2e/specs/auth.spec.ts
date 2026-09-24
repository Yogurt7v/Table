import { test, expect } from '../fixtures';
import { loginViaUi, logoutViaUi } from '../utils/ui';
import { E2E_USERS } from '../data';

test.describe('Аутентификация', () => {
  const ROLES = ['admin', 'moderator', 'user', 'boss', 'guest'] as const;

  for (const role of ROLES) {
    test(`вход/выход UI: роль ${role}`, async ({ page }) => {
      await loginViaUi(page, role);
      await expect(page.getByRole('heading', { name: 'Счета' }).first()).toBeVisible();
      await logoutViaUi(page);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('неверный пароль → ошибка на форме логина', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Логин').fill(E2E_USERS.admin.login);
    await page.getByLabel('Пароль').fill('wrong-password');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.getByText('Неверный логин или пароль')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('guest читает реестр без кнопок изменения', async ({ page }) => {
    await loginViaUi(page, 'guest');
    await expect(page.getByRole('heading', { name: 'Счета' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Добавить счёт' }).first().first().first().first().first().first().first().first().first().first().first().first().first().first().first()).toHaveCount(0);
  });
});
