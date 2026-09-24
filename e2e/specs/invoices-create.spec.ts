import { test, expect } from '../fixtures';
import { loginViaUi } from '../utils/ui';
import { authAs, resolveTestOrgId, findInvoiceByMarker } from '../utils/pb';
import { uniqueMarker } from '../data';

test.describe('Счета: создание', () => {
  test('создание через UI-форму, маркер виден в реестре и в БД (seq авт.)', async ({ page }) => {
    await loginViaUi(page, 'moderator');
    const pb = await authAs('moderator');
    const orgId = await resolveTestOrgId(pb);
    const marker = uniqueMarker('Счёт');

    await page.getByRole('button', { name: 'Добавить счёт' }).first().click();
    await page.locator('input[placeholder="Контрагент"]:visible').fill(marker);
    await page.locator('input[placeholder="Назначение"]:visible').fill('Оплата по договору');
    await page.locator('input[placeholder="Счет"]:visible').fill(uniqueMarker('№'));
    await page.locator('input[placeholder="Сумма"]:visible').fill('125000');
    await page.getByRole('button', { name: 'Сохранить счёт' }).filter({ visible: true }).first().click();
    await expect(page.getByText('Счёт добавлен').first()).toBeVisible();
    await expect(page.locator('table').getByText(marker).first()).toBeVisible();

    const inv = await findInvoiceByMarker(pb, marker);
    expect(inv).toBeTruthy();
    expect(Number(inv.amount)).toBe(125000);
    expect(Number(inv.seq)).toBeGreaterThan(0);
    expect(inv.organization_id).toBe(orgId);
  });
});

