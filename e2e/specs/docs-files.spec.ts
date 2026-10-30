import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, loginViaUi, logoutViaUi, uniqueMarker } from '../fixtures';
import {
  authAs,
  resolveTestOrgId,
  firstObjectId,
  createInvoice,
  payInvoiceFull,
} from '../utils/pb';

const firstFilePath = path.join(os.tmpdir(), `docs-files-a-${Date.now()}.txt`);
const secondFilePath = path.join(os.tmpdir(), `docs-files-b-${Date.now()}.txt`);

function basename(filePath: string): string {
  return path.basename(filePath);
}

test.beforeAll(() => {
  fs.writeFileSync(firstFilePath, 'первый файл документа');
  fs.writeFileSync(secondFilePath, 'второй файл документа');
});

test.afterAll(() => {
  fs.rmSync(firstFilePath, { force: true });
  fs.rmSync(secondFilePath, { force: true });
});

test.describe('Документы: файлы', () => {
  test('администратор загружает несколько файлов, удаление последнего снимает статусы', async ({
    page,
  }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокФайлыМного');
    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    const row = page.locator('tr').filter({ hasText: marker });
    await expect(row).toBeVisible();
    await row.click();

    const modal = page.getByRole('dialog');
    await modal.getByRole('tab', { name: 'Файлы' }).click();

    await page.setInputFiles('input[type="file"]', firstFilePath);
    await modal.getByRole('button', { name: 'Загрузить' }).click();
    await expect(page.getByRole('alert').getByText('Файл загружен')).toBeVisible();
    await modal.getByRole('tab', { name: 'Файлы' }).click();
    await expect(modal.getByText(basename(firstFilePath), { exact: true })).toBeVisible();

    await page.setInputFiles('input[type="file"]', secondFilePath);
    await modal.getByRole('button', { name: 'Загрузить' }).click();
    await expect(page.getByRole('alert').getByText('Файл загружен')).toBeVisible();
    await modal.getByRole('tab', { name: 'Файлы' }).click();
    await expect(modal.getByText(basename(secondFilePath), { exact: true })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Удалить файл' })).toHaveCount(2);

    await modal.getByRole('tab', { name: 'Документ' }).click();
    await expect(modal.getByText('Предоставлен', { exact: true }).first()).toBeVisible();
    await modal.getByText('Подтверждён', { exact: true }).first().click();
    await expect(page.getByRole('alert').getByText('Статус обновлён')).toBeVisible();
    await expect(modal.getByText('Подтверждён', { exact: true }).first()).toBeVisible();

    for (let index = 0; index < 2; index += 1) {
      await modal.getByRole('tab', { name: 'Файлы' }).click();
      await modal.getByRole('button', { name: 'Удалить файл' }).first().click();
      await page.getByRole('button', { name: 'Удалить', exact: true }).click();
      await expect(page.getByRole('alert').getByText('Файл удалён')).toBeVisible();
    }

    await modal.getByRole('tab', { name: 'Документ' }).click();
    await expect(modal.getByText('Предоставлен', { exact: true }).first()).toBeVisible();
    await expect(modal.getByText('Подтверждён', { exact: true }).first()).toBeVisible();
  });

  test('ответственный не удаляет чужой файл, но удаляет свой до подтверждения', async ({
    page,
  }) => {
    const adminPb = await authAs('admin');
    const userPb = await authAs('user');
    const orgId = await resolveTestOrgId(adminPb);
    const objectId = await firstObjectId(adminPb, orgId);
    const marker = uniqueMarker('ДокФайлыПрава');
    const invoice = await createInvoice(userPb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    const adminRow = page.locator('tr').filter({ hasText: marker });
    await expect(adminRow).toBeVisible();
    await adminRow.click();
    const adminModal = page.getByRole('dialog');
    await adminModal.getByRole('tab', { name: 'Файлы' }).click();
    await page.setInputFiles('input[type="file"]', firstFilePath);
    await adminModal.getByRole('button', { name: 'Загрузить' }).click();
    await expect(page.getByRole('alert').getByText('Файл загружен')).toBeVisible();
    await page.keyboard.press('Escape');
    await logoutViaUi(page);

    await loginViaUi(page, 'user');
    await page.goto('http://localhost:5173/docs');
    const userRow = page.locator('tr').filter({ hasText: marker });
    await expect(userRow).toBeVisible();
    await userRow.click();
    const userModal = page.getByRole('dialog');
    await userModal.getByRole('tab', { name: 'Файлы' }).click();
    await expect(userModal.getByRole('button', { name: 'Удалить файл' })).toHaveCount(0);

    await page.setInputFiles('input[type="file"]', secondFilePath);
    await userModal.getByRole('button', { name: 'Загрузить' }).click();
    await expect(page.getByRole('alert').getByText('Файл загружен')).toBeVisible();
    await expect(userModal.getByRole('button', { name: 'Удалить файл' })).toHaveCount(1);

    await userModal.getByRole('button', { name: 'Удалить файл' }).click();
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();
    await expect(page.getByRole('alert').getByText('Файл удалён')).toBeVisible();
    await expect(userModal.getByRole('button', { name: 'Удалить файл' })).toHaveCount(0);
  });

  test('файлы счёта показываются ссылками и не копируются в файлы документа', async ({ page }) => {
    const pb = await authAs('admin');
    const orgId = await resolveTestOrgId(pb);
    const objectId = await firstObjectId(pb, orgId);
    const marker = uniqueMarker('ДокФайлыСчёта');
    const invoice = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 1000 });
    await pb.collection('invoice_files').create({
      invoice_id: invoice.id,
      organization_id: orgId,
      name: 'исходный-счёт.txt',
      file: new File([fs.readFileSync(firstFilePath)], 'invoice-source.txt', { type: 'text/plain' }),
    });
    await payInvoiceFull(invoice.id as string, new Date().toISOString().slice(0, 10));

    await loginViaUi(page, 'admin');
    await page.goto('http://localhost:5173/docs');
    const row = page.locator('tr').filter({ hasText: marker });
    await expect(row).toBeVisible();
    await row.click();

    const modal = page.getByRole('dialog');
    await modal.getByRole('tab', { name: 'Файлы' }).click();
    await expect(modal.getByText('Файлов нет')).toBeVisible();

    await modal.getByRole('tab', { name: 'Документ' }).click();
    await expect(modal.getByText('Исходный счёт')).toBeVisible();
    await expect(modal.getByText('исходный-счёт.txt')).toBeVisible();
  });
});
