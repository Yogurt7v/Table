import { test, expect } from '@playwright/test';
import { pbAdmin } from '../utils/pb';
import { E2E_PASSWORD } from '../data';

test.describe('истечение сессии токена', () => {
  test('просроченный токен показывает модалку сессии и позволяет войти заново', async ({ page }) => {
    const pb = pbAdmin();
    await pb.collection('_superusers').authWithPassword('admin@example.com', E2E_PASSWORD).catch(async () => {
      await pb.collection('_superusers').authWithPassword('admin@example.com', '12345678');
    });
    const org = await pb.collection('organizations').getFirstListItem('name="E2E Org"').catch(async () => pb.collection('organizations').create({ name: 'E2E Org', color: '#228be6' }));
    const user = await pb.collection('users').getFirstListItem('login="admin"');
    try {
      await pb.collection('organization_users').getFirstListItem(`user_id="${user.id}" && organization_id="${org.id}"`);
    } catch {
      await pb.collection('organization_users').create({ user_id: user.id, organization_id: org.id, role: 'admin' });
    }
    try {
      await pb.collection('accounting_objects').getFirstListItem(`organization_id="${org.id}"`);
    } catch {
      await pb.collection('accounting_objects').create({ organization_id: org.id, name: 'Основной объект' });
    }

    await page.goto('/login');
    await page.getByLabel('Логин').fill('admin');
    await page.getByLabel('Пароль').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.getByRole('heading', { name: 'Счета' })).toBeVisible();

    await page.evaluate(() => {
      const exp = Math.floor(Date.now() / 1000) - 3600;
      const payload = btoa(JSON.stringify({ exp }));
      const token = `header.${payload}.signature`;
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({ token, record: { id: 'user-1', login: 'admin' } }),
      );
    });

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Сессия истекла' })).toBeVisible();
    await expect(page.getByText('Ваша сессия истекла. Войдите заново, чтобы продолжить работу.')).toBeVisible();

    await page.getByLabel('Логин').fill('admin');
    await page.getByLabel('Пароль').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Войти и продолжить' }).click();

    await expect(page.getByRole('heading', { name: 'Сессия истекла' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Счета' })).toBeVisible();
  });
});
