import { randomBytes } from 'node:crypto';
import { test, expect, loginViaUi, logoutViaUi, uniqueMarker } from '../fixtures';
import { authAs, createInvoice } from '../utils/pb';
import { E2E_PASSWORD } from '../data';

async function ensureRoleUser(
  adminPb: Awaited<ReturnType<typeof authAs>>,
  login: 'user' | 'moderator',
  role: 'user' | 'moderator',
  orgId: string,
  objectId: string,
) {
  const users = await adminPb.collection('users').getFullList({ filter: `login = "${login}"` });
  let user = users[0];
  if (!user) {
    user = await adminPb.collection('users').create({
      login,
      name: login,
      email: `${login}@e2e.local`,
      password: E2E_PASSWORD,
      passwordConfirm: E2E_PASSWORD,
      tokenKey: randomBytes(30).toString('hex'),
    });
  } else {
    try {
      await adminPb.collection('users').update(user.id, {
        password: E2E_PASSWORD,
        passwordConfirm: E2E_PASSWORD,
      });
    } catch {
      // ignore
    }
  }

  const memberships = await adminPb.collection('organization_users').getFullList({
    filter: `user_id = "${user.id}" && organization_id = "${orgId}"`,
  });
  const membership = memberships[0];
  if (!membership) {
    await adminPb.collection('organization_users').create({
      user_id: user.id,
      organization_id: orgId,
      role,
      objects: [objectId],
      can_create_invoices: true,
    });
  } else {
    const currentObjects = Array.isArray(membership.objects)
      ? (membership.objects as string[])
      : [];
    await adminPb.collection('organization_users').update(membership.id, {
      role,
      objects: Array.from(new Set([...currentObjects, objectId])),
      can_create_invoices: true,
    });
  }
  return user;
}

async function resolveTestContext(): Promise<{ orgId: string; orgName: string; objectId: string }> {
  const adminPb = await authAs('admin');
  const orgs = await adminPb.collection('organizations').getFullList({ sort: 'created' });
  if (orgs.length === 0) throw new Error('Нет организаций в тестовой БД');

  let chosen: { orgId: string; orgName: string; objectId: string } | null = null;

  for (const org of orgs) {
    const objects = await adminPb.collection('accounting_objects').getFullList({
      filter: `organization_id = "${org.id}"`,
      sort: 'created',
    });
    let objectId = objects[0]?.id as string | undefined;
    if (!objectId) {
      try {
        const created = await adminPb.collection('accounting_objects').create({
          organization_id: org.id,
          name: `E2E-obj-${Date.now()}`,
          sort: 1,
          is_active: true,
          counterparty_order: [],
        });
        objectId = created.id as string;
      } catch {
        continue;
      }
    }

    const adminUsers = await adminPb.collection('users').getFullList({ filter: 'login = "admin"' });
    const adminUser = adminUsers[0];
    if (!adminUser) continue;
    const adminMemberships = await adminPb.collection('organization_users').getFullList({
      filter: `user_id = "${adminUser.id}" && organization_id = "${org.id}"`,
    });
    const adminMembership = adminMemberships[0];
    if (adminMembership) {
      const current = Array.isArray(adminMembership.objects)
        ? (adminMembership.objects as string[])
        : [];
      if (!current.includes(objectId!)) {
        await adminPb.collection('organization_users').update(adminMembership.id, {
          objects: [...current, objectId],
        });
      }
      chosen = { orgId: org.id as string, orgName: String(org.name), objectId: objectId! };
      break;
    }
  }

  if (!chosen) {
    const org = orgs[0]!;
    const objects = await adminPb.collection('accounting_objects').getFullList({
      filter: `organization_id = "${org.id}"`,
      sort: 'created',
    });
    let objectId = objects[0]?.id as string | undefined;
    if (!objectId) {
      const created = await adminPb.collection('accounting_objects').create({
        organization_id: org.id,
        name: `E2E-obj-${Date.now()}`,
        sort: 1,
        is_active: true,
        counterparty_order: [],
      });
      objectId = created.id as string;
    }
    const adminUser = (
      await adminPb.collection('users').getFullList({ filter: 'login = "admin"' })
    )[0];
    if (adminUser) {
      const existing = await adminPb.collection('organization_users').getFullList({
        filter: `user_id = "${adminUser.id}" && organization_id = "${org.id}"`,
      });
      if (!existing[0]) {
        await adminPb.collection('organization_users').create({
          user_id: adminUser.id,
          organization_id: org.id,
          role: 'admin',
          objects: [objectId],
          can_create_invoices: true,
        });
      }
    }
    chosen = { orgId: org.id as string, orgName: String(org.name), objectId: objectId! };
  }

  await ensureRoleUser(adminPb, 'moderator', 'moderator', chosen.orgId, chosen.objectId);
  await ensureRoleUser(adminPb, 'user', 'user', chosen.orgId, chosen.objectId);

  return chosen;
}

async function selectOrgIfNeeded(page: import('@playwright/test').Page, orgName: string) {
  const orgSelect = page.getByPlaceholder('Выберите организацию').first();
  if ((await orgSelect.count()) === 0) return;
  const current = await orgSelect.inputValue().catch(() => '');
  if (current !== orgName) {
    await orgSelect.click();
    await page.getByRole('option', { name: orgName, exact: true }).click();
    await expect(orgSelect).toHaveValue(orgName);
  }
}

test.describe('Навигация к оплаченному счёту из уведомления', () => {
  test('админ видит все строки, статус и дату оплаты после перехода по уведомлению; у пользователя создаётся документ', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const marker = uniqueMarker('ОплУвед');
    const today = new Date().toISOString().slice(0, 10);
    const { orgId, orgName, objectId } = await resolveTestContext();

    const adminPb = await authAs('admin');

    // Дополнительные счета на ту же дату/объект, чтобы проверить, что строки после целевого не пропадают.
    const beforeMarker = `${marker}-A-до`;
    const targetMarker = `${marker}-B-целевой`;
    const afterMarker = `${marker}-C-после`;

    await createInvoice(adminPb, {
      orgId,
      objectId,
      date: today,
      counterparty: beforeMarker,
      amount: 1000,
    });

    const userPb = await authAs('user');
    const targetInvoice = await createInvoice(userPb, {
      orgId,
      objectId,
      date: today,
      counterparty: targetMarker,
      amount: 2000,
    });

    await createInvoice(adminPb, {
      orgId,
      objectId,
      date: today,
      counterparty: afterMarker,
      amount: 3000,
    });

    // Модератор отмечает целевой счёт оплаченным (через API, чтобы не зависеть от UI-прав/раскладки таблицы).
    const moderatorPb = await authAs('moderator');
    await moderatorPb.collection('invoices').update(String(targetInvoice.id), {
      paid: true,
      paid_date: today,
      paid_amount: 0,
      payment_amounts: [],
    });

    // Админ переходит к оплаченному счёту по уведомлению.
    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173');
    await selectOrgIfNeeded(page, orgName);

    await page.getByRole('button', { name: /Уведомления/ }).click();
    const drawer = page.getByRole('dialog').filter({ hasText: 'Уведомления' });
    await expect(drawer).toBeVisible();

    const paidNotification = drawer.getByText(`Счёт оплачен: ${targetMarker}`).first();
    await expect(paidNotification).toBeVisible();
    await paidNotification.click();

    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL('http://localhost:5173/');

    // Все три счёта должны быть видны (включая строки после целевого).
    const beforeRow = page.locator('tr').filter({ hasText: beforeMarker }).first();
    const targetRowAfterNav = page.locator('tr').filter({ hasText: targetMarker }).first();
    const afterRow = page.locator('tr').filter({ hasText: afterMarker }).first();

    await expect(beforeRow).toBeVisible();
    await expect(targetRowAfterNav).toBeVisible();
    await expect(afterRow).toBeVisible();

    await expect
      .poll(async () => {
        const rows = page.locator('tr').filter({ hasText: marker });
        const count = await rows.count();
        let visible = 0;
        for (let i = 0; i < count; i++) {
          if (await rows.nth(i).isVisible()) visible += 1;
        }
        return visible;
      })
      .toBeGreaterThanOrEqual(3);

    // У целевого счёта должен быть виден статус оплаты и дата оплаты.
    await expect(targetRowAfterNav.getByRole('button', { name: 'Оплатить' })).toHaveCount(0);
    await expect(targetRowAfterNav.getByText(/\d{2}\.\d{2}\.\d{4}/).first()).toBeVisible();

    await logoutViaUi(page);

    // Пользователь должен увидеть документ по оплаченному счёту для предоставления закрывающих.
    await loginViaUi(page, 'user');
    await page.goto('http://localhost:5173/docs');
    await selectOrgIfNeeded(page, orgName);
    await expect(page.getByText('Документы')).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: targetMarker }).first()).toBeVisible();
  });
});
