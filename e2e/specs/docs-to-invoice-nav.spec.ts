import { test, expect, loginViaUi, logoutViaUi, uniqueMarker } from '../fixtures';
import { authAs, createInvoice } from '../utils/pb';

test.describe('Навигация из уведомления о счёте со страницы документов', () => {
  test('клик по уведомлению о счёте с /docs перекидывает на страницу счетов и подсвечивает счёт', async ({
    page,
    orgId,
    objectId,
  }) => {
    const marker = uniqueMarker('НавСчёт');

    await loginViaUi(page, 'user');
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('button', { name: 'Выйти' }).first()).toBeVisible();

    const pbUser = await authAs('user');
    await createInvoice(pbUser, {
      orgId,
      objectId,
      counterparty: marker,
      amount: 1000,
    });

    await logoutViaUi(page);
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    await expect(page.getByText('Документы')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выйти' }).first()).toBeVisible();

    await page.getByRole('button', { name: /Уведомления/ }).click();
    const drawer = page.getByRole('dialog').filter({ hasText: 'Уведомления' });
    await expect(drawer).toBeVisible();
    await expect(page.getByText(`Создан счёт: ${marker}`)).toBeVisible();
    await page.getByText(`Создан счёт: ${marker}`).first().click();

    await expect(page).toHaveURL('http://localhost:5173/');

    const invoiceRow = page.getByRole('row').filter({ hasText: marker });
    await expect(invoiceRow).toBeVisible();
  });
});
