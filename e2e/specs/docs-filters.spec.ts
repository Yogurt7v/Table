import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import {
  authAs,
  resolveTestOrgId,
  firstObjectId,
  createInvoice,
  payInvoiceFull,
  todayIso,
} from '../utils/pb';

test.describe('Документы: фильтр по контрагенту', () => {
  test('подсказки из базы контрагентов, фильтрация по подстроке, счётчик и сброс', async ({
    page,
  }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const base = uniqueMarker('ДокФильтрКонтрагент');
    const alpha = `${base}-Альфа`;
    const beta = `${base}-Бета`;

    for (const counterparty of [alpha, beta]) {
      const invoice = await createInvoice(pb, { orgId, objectId, counterparty, amount: 1000 });
      await payInvoiceFull(invoice.id as string, todayIso());
    }

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');

    const alphaRow = page.locator('tr').filter({ hasText: alpha });
    const betaRow = page.locator('tr').filter({ hasText: beta });
    await expect(alphaRow).toBeVisible();
    await expect(betaRow).toBeVisible();

    await page.getByRole('button', { name: 'Фильтр', exact: true }).click();
    const menu = page.getByRole('menu');
    const input = menu.getByRole('textbox', { name: 'Контрагент' });

    await input.fill(base);
    await expect(page.getByRole('option', { name: alpha, exact: true })).toBeVisible();
    await page.getByRole('option', { name: beta, exact: true }).click();

    await expect(input).toHaveValue(beta);
    await expect(betaRow).toBeVisible();
    await expect(alphaRow).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Фильтр (1)', exact: true })).toBeVisible();

    await menu.getByRole('button', { name: 'Очистить контрагента' }).click();
    await expect(input).toHaveValue('');
    await expect(alphaRow).toBeVisible();
    await expect(betaRow).toBeVisible();
    await expect(page.getByRole('button', { name: 'Фильтр', exact: true })).toBeVisible();

    await input.fill(base);
    await menu.getByRole('menuitem', { name: 'Сбросить' }).click();
    await expect(alphaRow).toBeVisible();
    await expect(betaRow).toBeVisible();
    await expect(page.getByRole('button', { name: 'Фильтр', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Фильтр', exact: true }).click();
    await expect(page.getByRole('menu').getByRole('textbox', { name: 'Контрагент' })).toHaveValue(
      '',
    );
  });
});

test.describe('Документы: фильтр по объекту', () => {
  test('MultiSelect по доступным объектам и пункт «Все объекты»', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectList = await pb.collection('accounting_objects').getList(1, 2, {
      filter: `organization_id = "${orgId}"`,
      sort: 'created',
    });
    const firstObject = objectList.items[0];
    const secondObject = objectList.items[1];
    test.skip(!firstObject || !secondObject, 'нужно минимум два объекта учёта');
    if (!firstObject || !secondObject) return;

    const firstMarker = uniqueMarker('ДокОбъектПервый');
    const secondMarker = uniqueMarker('ДокОбъектВторой');
    for (const [objectId, counterparty] of [
      [firstObject.id, firstMarker],
      [secondObject.id, secondMarker],
    ] as const) {
      const invoice = await createInvoice(pb, { orgId, objectId, counterparty, amount: 1000 });
      await payInvoiceFull(invoice.id as string, todayIso());
    }

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');

    const firstRow = page.locator('tr').filter({ hasText: firstMarker });
    const secondRow = page.locator('tr').filter({ hasText: secondMarker });
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    await page.getByRole('button', { name: 'Фильтр', exact: true }).click();
    const menu = page.getByRole('menu');
    await menu.getByPlaceholder('Выберите объекты').click();
    await page.getByRole('option', { name: firstObject.name, exact: true }).click();

    await expect(firstRow).toBeVisible();
    await expect(secondRow).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Фильтр (1)', exact: true })).toBeVisible();

    await page.getByText('Документы').click();
    await page.getByRole('button', { name: 'Фильтр (1)', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Все объекты' }).click();

    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();
    await expect(page.getByRole('button', { name: 'Фильтр', exact: true })).toBeVisible();
  });
});
