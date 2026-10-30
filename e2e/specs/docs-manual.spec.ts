import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import {
  authAs,
  resolveTestOrgId,
  firstObjectId,
  createInvoice,
  createDocumentManually,
  findDocumentByMarker,
  todayIso,
} from '../utils/pb';

test.describe('Документы: ручное создание', () => {
  test('администратор создаёт ручной документ с обязательными полями', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокРучной');

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    await page.getByRole('button', { name: 'Добавить документ' }).click();

    const modal = page.getByRole('dialog', { name: 'Новый документ' });
    await modal.getByLabel('Объект').click();
    await page.getByRole('option').first().click();
    await modal.getByLabel('Контрагент').fill(marker);
    await modal.getByLabel('Сумма').fill('1500');
    await modal.getByRole('button', { name: 'Создать документ' }).click();

    await expect(page.getByText('Документ создан')).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: marker })).toBeVisible();

    const document = await findDocumentByMarker(pb, marker);
    expect(document?.creation_mode).toBe('manual');
    expect(document?.sync_locked).toBe(true);
    expect(Number(document?.seq)).toBeGreaterThan(0);
    expect(document?.organization_id).toBe(orgId);
    expect(String(document?.payment_date).slice(0, 10)).toBe(todayIso());
    expect(Number(document?.amount)).toBe(1500);
  });

  test('ручной документ со связанным счётом подтягивает реквизиты и фиксируется как ручной', async ({
    page,
  }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокРучСчёт');
    const invoice = await createInvoice(pb, {
      orgId,
      objectId,
      counterparty: marker,
      amount: 777,
      invoice_no: '77',
    });

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    await page.getByRole('button', { name: 'Добавить документ' }).click();

    const modal = page.getByRole('dialog', { name: 'Новый документ' });
    const invoiceSelect = modal.getByLabel('Связанный счёт');
    await invoiceSelect.click();
    await invoiceSelect.fill(marker);
    await page.getByRole('option').filter({ hasText: marker }).first().click();

    await expect(modal.getByLabel('Контрагент')).toHaveValue(marker);
    await expect(modal.getByLabel('Сумма')).toHaveValue('777');

    await modal.getByRole('button', { name: 'Создать документ' }).click();
    await expect(page.getByText('Документ создан')).toBeVisible();

    const document = await findDocumentByMarker(pb, marker);
    expect(document?.source_invoice_id).toBe(invoice.id);
    expect(document?.creation_mode).toBe('manual');
    expect(document?.sync_locked).toBe(true);
  });

  test('ответственный не может создать ручной документ', async ({ page }) => {
    await loginViaUi(page, 'boss');
    await page.goto('http://localhost:5173/docs');

    await expect(page.getByText('Документы')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Добавить документ' })).toHaveCount(0);
  });

  test('несколько ручных документов по одному счёту разрешены', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const responsibleId = pb.authStore.model?.id as string;
    const invoiceMarker = uniqueMarker('ДокДубльСчёт');
    const invoice = await createInvoice(pb, {
      orgId,
      objectId,
      counterparty: invoiceMarker,
      amount: 500,
    });
    const firstMarker = uniqueMarker('ДокДубльОдин');
    const secondMarker = uniqueMarker('ДокДубльДва');

    for (const marker of [firstMarker, secondMarker]) {
      await createDocumentManually(pb, {
        orgId,
        objectId,
        paymentDate: todayIso(),
        counterparty: marker,
        responsibleId,
        sourceInvoiceId: invoice.id as string,
        sourceInvoiceNo: '1',
      });
    }

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    await expect(page.locator('tr').filter({ hasText: firstMarker })).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: secondMarker })).toBeVisible();
  });
});
