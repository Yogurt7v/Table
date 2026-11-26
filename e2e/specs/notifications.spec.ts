import dayjs from 'dayjs';
import 'dayjs/locale/ru.js';
import { test, expect, loginViaUi, logoutViaUi, uniqueMarker } from '../fixtures';
import { authAs, createInvoice } from '../utils/pb';

dayjs.locale('ru');

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

  test('клик по уведомлению о созданном счёте ведёт к счёту, подсвечивает и скроллит к видимой строке', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const marker = uniqueMarker('СоздУвед');
    const today = new Date().toISOString().slice(0, 10);
    const userPb = await authAs('user');
    const invoice = await createInvoice(userPb, {
      date: today,
      counterparty: marker,
      amount: 4242,
    });
    const invoiceId = String(invoice.id);

    await loginViaUi(page, 'admin');

    await page.getByRole('button', { name: /Уведомления/ }).click();
    const drawer = page.getByRole('dialog').filter({ hasText: 'Уведомления' });
    await expect(drawer).toBeVisible();

    const notification = drawer.getByText(`Создан счёт: ${marker}`).first();
    await expect(notification).toBeVisible();
    await notification.click();

    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL('http://localhost:5173/');

    const targetRow = page.locator('tr').filter({ hasText: marker }).first();
    await expect(targetRow).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate((id) => {
          const sel = `[data-highlight-id="${CSS.escape(id)}"]`;
          const visible = [...document.querySelectorAll(sel)].find(
            (el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height > 0,
          );
          if (!visible) return null;
          const rect = visible.getBoundingClientRect();
          return {
            tag: visible.tagName,
            rowFlash: visible.classList.contains('row-flash'),
            inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
          };
        }, invoiceId),
      )
      .toMatchObject({ tag: 'TR', rowFlash: true, inViewport: true });
  });

  test('клик по уведомлению ведёт на день счёта (candidate dates) и подсвечивает счёт', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const marker = uniqueMarker('ДатаУвед');
    const invoiceDate = dayjs().subtract(6, 'day');
    const invoiceDateStr = invoiceDate.format('YYYY-MM-DD');
    const adminPb = await authAs('admin');
    const userPb = await authAs('user');

    const invoice = await createInvoice(userPb, {
      date: invoiceDateStr,
      counterparty: marker,
      amount: 5151,
    });
    const invoiceId = String(invoice.id);
    await adminPb.collection('invoices').update(invoiceId, {
      paid: true,
      paid_date: invoiceDateStr,
      paid_amount: 0,
      payment_amounts: [],
    });

    await loginViaUi(page, 'admin');
    const datePicker = page.getByRole('button', { name: 'Выбор даты' }).first();
    await expect(datePicker).toBeVisible();

    await page.getByRole('button', { name: /Уведомления/ }).click();
    const drawer = page.getByRole('dialog').filter({ hasText: 'Уведомления' });
    await expect(drawer).toBeVisible();
    await drawer.getByText(`Создан счёт: ${marker}`).first().click();
    await expect(drawer).toBeHidden();

    const expectedLabel = invoiceDate.format('D MMMM YYYY, dddd');
    await expect(datePicker).toContainText(expectedLabel, { timeout: 20000 });
    await expect(page.locator('tr').filter({ hasText: marker }).first()).toBeVisible({ timeout: 20000 });

    await expect
      .poll(async () =>
        page.evaluate((id) => {
          const sel = `[data-highlight-id="${CSS.escape(id)}"]`;
          const visible = [...document.querySelectorAll(sel)].find(
            (el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height > 0,
          );
          return visible ? visible.classList.contains('row-flash') : false;
        }, invoiceId),
      )
      .toBe(true);
  });

  test('клик по уведомлению из другой организации переключает org и подсвечивает счёт', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const marker = uniqueMarker('ОргУвед');
    const today = dayjs().format('YYYY-MM-DD');
    const adminPb = await authAs('admin');

    const otherOrg = await adminPb.collection('organizations').create({
      name: `E2E-Notif-Org-${Date.now()}`,
      color: '#228be6',
    });
    const otherObject = await adminPb.collection('accounting_objects').create({
      organization_id: otherOrg.id,
      name: 'Notif Object',
      sort: 1,
      is_active: true,
      counterparty_order: [],
    });

    const adminUsers = await adminPb.collection('users').getFullList({ filter: 'login = "admin"' });
    const adminUser = adminUsers[0];
    const userUsers = await adminPb.collection('users').getFullList({ filter: 'login = "user"' });
    const userUser = userUsers[0];
    await adminPb.collection('organization_users').create({
      user_id: adminUser.id,
      organization_id: otherOrg.id,
      role: 'admin',
      objects: [otherObject.id],
      can_create_invoices: true,
      can_view_invoices: true,
      can_view_documents: true,
    });
    await adminPb.collection('organization_users').create({
      user_id: userUser.id,
      organization_id: otherOrg.id,
      role: 'user',
      objects: [otherObject.id],
      can_create_invoices: true,
      can_view_invoices: true,
      can_view_documents: true,
    });

    const userPb = await authAs('user');
    const invoice = await createInvoice(userPb, {
      orgId: otherOrg.id,
      objectId: otherObject.id,
      date: today,
      counterparty: marker,
      amount: 7777,
    });
    const invoiceId = String(invoice.id);

    await loginViaUi(page, 'admin');
    const orgSelect = page.getByPlaceholder('Выберите организацию').first();
    await expect(orgSelect).toBeAttached();
    if ((await orgSelect.inputValue()) === otherOrg.name) {
      await orgSelect.click();
      await page.getByRole('option', { name: 'E2E Org', exact: true }).click();
    }
    await expect(orgSelect).not.toHaveValue(otherOrg.name);

    await page.getByRole('button', { name: /Уведомления/ }).click();
    const drawer = page.getByRole('dialog').filter({ hasText: 'Уведомления' });
    await expect(drawer).toBeVisible();
    await drawer.getByText(`Создан счёт: ${marker}`).first().click();
    await expect(drawer).toBeHidden();

    await expect(orgSelect).toHaveValue(otherOrg.name, { timeout: 20000 });
    await expect(page.locator('tr').filter({ hasText: marker }).first()).toBeVisible({ timeout: 20000 });

    await expect
      .poll(async () =>
        page.evaluate((id) => {
          const sel = `[data-highlight-id="${CSS.escape(id)}"]`;
          const visible = [...document.querySelectorAll(sel)].find(
            (el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height > 0,
          );
          return visible ? visible.classList.contains('row-flash') : false;
        }, invoiceId),
      )
      .toBe(true);
  });

  test('автор не получает уведомление о созданном им счёте, другой участник получает', async ({
    page,
  }) => {
    const adminPb = await authAs('admin');
    const marker = uniqueMarker('АвторУвед');
    await createInvoice(adminPb, { counterparty: marker, amount: 333 });

    await loginViaUi(page, 'admin');
    await page.getByRole('button', { name: /Уведомления/ }).click();
    const drawer = page.getByRole('dialog').filter({ hasText: 'Уведомления' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(`Создан счёт: ${marker}`)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await logoutViaUi(page);
    await loginViaUi(page, 'moderator');
    await page.getByRole('button', { name: /Уведомления/ }).click();
    const moderatorDrawer = page.getByRole('dialog').filter({ hasText: 'Уведомления' });
    await expect(moderatorDrawer).toBeVisible();
    await expect(moderatorDrawer.getByText(`Создан счёт: ${marker}`).first()).toBeVisible();
  });
});
