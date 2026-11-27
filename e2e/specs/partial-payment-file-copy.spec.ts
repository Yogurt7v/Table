import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, loginViaUi, uniqueMarker } from '../fixtures';
import { authAs, resolveTestOrgId, firstObjectId, createInvoice } from '../utils/pb';

const attachmentPath = path.join(os.tmpdir(), `partial-copy-${Date.now()}.txt`);
const attachmentName = path.basename(attachmentPath);

test.beforeAll(() => {
  fs.writeFileSync(attachmentPath, 'файл для копии остатка');
});

test.afterAll(() => {
  fs.rmSync(attachmentPath, { force: true });
});

test.describe('Частичная оплата: копия-остаток', () => {
  test('создаёт копию-остаток с комментарием и файлами оригинала', async ({ page }) => {
    const pb = await authAs('moderator');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ЧастФайл');
    const originalComment = 'Исходный комментарий';

    const invoice = await createInvoice(pb, {
      orgId,
      objectId,
      counterparty: marker,
      amount: 10000,
      comment: originalComment,
    });

    await pb.collection('invoice_files').create({
      invoice_id: invoice.id as string,
      organization_id: orgId,
      name: attachmentName,
      file: new File([fs.readFileSync(attachmentPath)], attachmentName, { type: 'text/plain' }),
    });

    await loginViaUi(page, 'moderator');
    await page.goto('http://localhost:5173');

    const row = page.locator('tr').filter({ hasText: marker }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Оплатить' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Сумма к оплате').fill('4000');
    await dialog.getByRole('button', { name: 'Оплатить' }).click();

    await expect(page.getByText('Статус счёта обновлён')).toBeVisible();

    await expect
      .poll(async () => {
        const copies = await pb.collection('invoices').getFullList({
          filter: `original_invoice_id = "${invoice.id as string}"`,
        });
        return copies.length;
      })
      .toBe(1);

    const copies = await pb.collection('invoices').getFullList({
      filter: `original_invoice_id = "${invoice.id as string}"`,
    });
    const copy = copies[0]!;
    expect(Number(copy.amount)).toBe(6000);
    expect(copy.comment).toBe(`Остаток. см историю.\n${originalComment}`);

    await expect
      .poll(async () => {
        const files = await pb.collection('invoice_files').getFullList({
          filter: `invoice_id = "${copy.id}" && is_deleted != true`,
        });
        return files.map((f) => f.name).sort();
      })
      .toEqual([attachmentName]);
  });

  test('показывает window.alert при сбое проверки копирования файлов', async ({ page }) => {
    const pb = await authAs('moderator');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ЧастAlert');
    const originalComment = 'Комментарий для alert';

    const invoice = await createInvoice(pb, {
      orgId,
      objectId,
      counterparty: marker,
      amount: 10000,
      comment: originalComment,
    });

    await pb.collection('invoice_files').create({
      invoice_id: invoice.id as string,
      organization_id: orgId,
      name: attachmentName,
      file: new File([fs.readFileSync(attachmentPath)], attachmentName, { type: 'text/plain' }),
    });

    let copyId = '';
    await page.route('**/api/collections/invoice_files/records**', async (route) => {
      const url = route.request().url();
      if (copyId && url.includes(encodeURIComponent(copyId))) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ page: 1, perPage: 500, totalItems: 0, totalPages: 1, items: [] }),
        });
        return;
      }
      await route.continue();
    });

    await loginViaUi(page, 'moderator');
    await page.goto('http://localhost:5173');

    const row = page.locator('tr').filter({ hasText: marker }).first();
    await expect(row).toBeVisible();

    const dialogPromise = page.waitForEvent('dialog');
    await row.getByRole('button', { name: 'Оплатить' }).first().click();
    const payDialog = page.getByRole('dialog');
    await expect(payDialog).toBeVisible();
    await payDialog.getByLabel('Сумма к оплате').fill('4000');
    await payDialog.getByRole('button', { name: 'Оплатить' }).click();

    await expect
      .poll(async () => {
        const copies = await pb.collection('invoices').getFullList({
          filter: `original_invoice_id = "${invoice.id as string}"`,
        });
        copyId = copies[0]?.id ?? '';
        return copies.length;
      })
      .toBe(1);

    const alertDialog = await dialogPromise;
    expect(alertDialog.type()).toBe('alert');
    expect(alertDialog.message()).toContain('Не удалось скопировать файлы в копию счёта');
    expect(alertDialog.message()).toContain(attachmentName);
    await alertDialog.accept();
  });
});
