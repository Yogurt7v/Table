import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { humanDateButtonLabel, humanDayLabel, humanShortMonth, humanYear } from './human';
import { APP } from './ui';

export async function openRegistry(page: Page): Promise<void> {
  await page.goto(APP);
  await expect(page.locator('button[data-dates-input="true"]:visible').first()).toBeVisible();
}

export function registryDateTrigger(page: Page): Locator {
  return page.locator('button[data-dates-input="true"]:visible').first();
}

function calendarDialog(page: Page): Locator {
  return page.locator('[role="dialog"]:visible').last();
}

export async function setRegistryDate(page: Page, iso: string): Promise<void> {
  const trigger = registryDateTrigger(page);
  await expect(trigger).toBeVisible();
  if ((await trigger.textContent())?.trim() === humanDateButtonLabel(iso)) return;
  await trigger.click();
  const dialog = calendarDialog(page);
  const day = dialog.locator(`.mantine-DatePickerInput-day[aria-label="${humanDayLabel(iso)}"]`);
  if ((await day.count()) === 0) {
    const level = dialog.locator('.mantine-DatePickerInput-calendarHeaderLevel');
    await level.click();
    const shownYear = ((await level.textContent()) ?? '').trim();
    if (shownYear !== humanYear(iso)) {
      await level.click();
      await dialog
        .locator('.mantine-DatePickerInput-yearsListControl')
        .filter({ hasText: new RegExp(`^${humanYear(iso)}$`) })
        .click();
    }
    await dialog
      .locator('.mantine-DatePickerInput-monthsListControl')
      .filter({ hasText: new RegExp(`^${humanShortMonth(iso)}\\.?$`) })
      .click();
  }
  await day.click();
  await expect(trigger).toHaveText(humanDateButtonLabel(iso));
}

export async function openAdmin(page: Page): Promise<void> {
  await page.goto(`${APP}admin`);
  await expect(page.getByRole('heading', { name: 'Администрирование' })).toBeVisible();
}

export async function selectOrg(page: Page, orgName: string): Promise<void> {
  const select = page.locator('input[placeholder="Выберите организацию"]:visible').first();
  await expect(select).toBeVisible();
  if ((await select.inputValue()) === orgName) return;
  await select.click();
  await page.getByRole('option', { name: orgName, exact: true }).click();
  await expect(select).toHaveValue(orgName);
}

export async function openEditOrgModal(page: Page, orgName: string): Promise<Locator> {
  await page.getByRole('button', { name: `Редактировать «${orgName}»` }).click();
  const modal = page.getByRole('dialog').filter({ hasText: `Редактирование: ${orgName}` });
  await expect(modal.getByLabel('Название')).toBeVisible();
  return modal;
}

export async function renameObject(
  page: Page,
  modal: Locator,
  currentName: string,
  newName: string,
): Promise<void> {
  await modal.getByRole('button', { name: `Редактировать «${currentName}»` }).click();
  const row = modal
    .getByRole('button', { name: `Сохранить «${currentName}»` })
    .locator('xpath=ancestor::div[count(.//button)=2][1]');
  await row.locator('input').fill(newName);
  await modal.getByRole('button', { name: `Сохранить «${currentName}»` }).click();
  await expect(modal.getByText(newName, { exact: true })).toBeVisible();
}

export async function moveObject(
  page: Page,
  modal: Locator,
  name: string,
  direction: 'up' | 'down',
): Promise<void> {
  const word = direction === 'up' ? 'вверх' : 'вниз';
  await modal.getByRole('button', { name: `Переместить «${name}» ${word}` }).click();
  await page.waitForTimeout(300);
}

export async function deleteObject(page: Page, modal: Locator, name: string): Promise<void> {
  await modal.getByRole('button', { name: `Удалить «${name}»` }).click();
  await page.getByRole('dialog').filter({ hasText: 'Удаление объекта' }).getByRole('button', {
    name: 'Удалить',
  }).click();
  await expect(modal.getByRole('button', { name: `Удалить «${name}»` })).toHaveCount(0, {
    timeout: 15_000,
  });
}

function accountRow(modal: Locator, accountNumber: string): Locator {
  return modal
    .getByText(accountNumber, { exact: true })
    .locator('xpath=ancestor::div[count(.//button)=2][1]');
}

export async function deleteBankAccount(
  page: Page,
  modal: Locator,
  accountNumber: string,
): Promise<void> {
  await accountRow(modal, accountNumber).getByRole('button').nth(1).click();
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Удаление счёта' })
    .getByRole('button', { name: 'Удалить', exact: true })
    .click();
  await expect(modal.getByText(accountNumber, { exact: true })).toHaveCount(0, {
    timeout: 15_000,
  });
}

export async function closeOrgModal(page: Page, modal: Locator): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
}

export function objectBlock(page: Page, objectName: string): Locator {
  return page
    .getByRole('heading', { name: objectName, exact: true })
    .locator('xpath=ancestor::*[.//button[normalize-space()="Добавить счёт"]][1]');
}

export async function addInvoiceViaDraft(
  page: Page,
  objectName: string,
  data: {
    counterparty: string;
    purpose: string;
    invoiceNo: string;
    amount: string;
    contractNo?: string;
    comment?: string;
  },
): Promise<Locator> {
  const block = objectBlock(page, objectName);
  await block.getByRole('button', { name: 'Добавить счёт' }).first().click();
  const form = page.locator('input[placeholder="Контрагент"]:visible').locator('xpath=ancestor::tr');
  await form.locator('input[placeholder="Контрагент"]').fill(data.counterparty);
  await form.locator('textarea[placeholder="Назначение"], input[placeholder="Назначение"]').fill(
    data.purpose,
  );
  if (data.contractNo) {
    await form.locator('input[placeholder="Договор"]').fill(data.contractNo);
  }
  await form.locator('input[placeholder="Счет"]').fill(data.invoiceNo);
  await form.locator('input[placeholder="Сумма"]').fill(data.amount);
  if (data.comment) {
    await form.locator('input[placeholder="Комментарий"]').fill(data.comment);
  }
  await form.getByRole('button', { name: 'Сохранить счёт' }).click();
  await expect(page.getByText('Счёт добавлен').first()).toBeVisible();
  return form;
}

export function invoiceRow(page: Page, counterparty: string): Locator {
  return page.getByRole('row').filter({ hasText: counterparty });
}

export async function openInvoiceMenu(
  page: Page,
  counterparty: string,
  item: string,
): Promise<void> {
  const row = invoiceRow(page, counterparty);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Действия со счётом' }).first().click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: item, exact: true }).click();
}

export async function invoiceMenuItems(page: Page, counterparty: string): Promise<string[]> {
  const row = invoiceRow(page, counterparty);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Действия со счётом' }).first().click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeVisible();
  const items = await menu.getByRole('menuitem').allTextContents();
  await page.keyboard.press('Escape');
  return items.map((t) => t.trim());
}

export async function editInvoice(
  page: Page,
  counterparty: string,
  changes: { amount?: string; comment?: string; invoiceNo?: string },
): Promise<void> {
  await openInvoiceMenu(page, counterparty, 'Редактировать');
  const modal = page.getByRole('dialog').filter({ hasText: 'Редактирование счёта' });
  await expect(modal).toBeVisible();
  if (changes.amount) await modal.getByLabel('Сумма').fill(changes.amount);
  if (changes.invoiceNo) await modal.getByLabel('Номер счёта').fill(changes.invoiceNo);
  if (changes.comment) await modal.getByLabel('Комментарий').fill(changes.comment);
  await modal.getByRole('button', { name: 'Сохранить' }).click();
  await expect(modal).toBeHidden();
}

export async function moveInvoice(
  page: Page,
  counterparty: string,
  targetObject: string,
): Promise<void> {
  await openInvoiceMenu(page, counterparty, 'Перенести');
  const modal = page.getByRole('dialog').filter({ hasText: 'Перенести в другой объект' });
  await modal.getByLabel('Объект учёта').click();
  await page.getByRole('option', { name: targetObject, exact: true }).click();
  await modal.getByRole('button', { name: 'Перенести', exact: true }).click();
  await expect(modal).toBeHidden();
}

export async function copyInvoice(
  page: Page,
  counterparty: string,
  changes: { counterparty: string; invoiceNo: string; amount?: string },
): Promise<void> {
  await openInvoiceMenu(page, counterparty, 'Копировать');
  const form = page.locator('input[placeholder="Контрагент"]:visible').locator('xpath=ancestor::tr');
  await expect(form).toBeVisible();
  await form.locator('input[placeholder="Контрагент"]').fill(changes.counterparty);
  if (changes.amount) await form.locator('input[placeholder="Сумма"]').fill(changes.amount);
  await form.locator('input[placeholder="Счет"]').fill(changes.invoiceNo);
  await form.getByRole('button', { name: 'Сохранить счёт' }).click();
  await expect(page.getByText('Счёт добавлен').first()).toBeVisible();
}

export async function uploadInvoiceFile(
  page: Page,
  counterparty: string,
  filePath: string,
): Promise<void> {
  const existing = filesDialog(page);
  if ((await existing.count()) > 0) {
    await closeFilesModal(page);
  }
  await openInvoiceMenu(page, counterparty, 'Файлы');
  const modal = filesDialog(page);
  await expect(modal).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await modal.getByRole('button', { name: 'Выбрать файл' }).click();
  await (await chooser).setFiles(filePath);
  await modal.getByRole('button', { name: 'Загрузить' }).click();
  await expect(page.getByText('Файл загружен')).toBeVisible();
}

export async function deleteInvoiceFile(
  page: Page,
  counterparty: string,
  fileName: string,
): Promise<void> {
  const modal = filesDialog(page);
  const row = modal.getByText(fileName, { exact: true }).locator('xpath=ancestor::div[.//button][1]');
  await row.getByRole('button', { name: 'Удалить файл' }).click();
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Удаление файла' })
    .getByRole('button', { name: 'Удалить' })
    .click();
  await expect(modal.getByText(fileName, { exact: true })).toHaveCount(0);
  await closeFilesModal(page);
}

function filesDialog(page: Page): Locator {
  return page.getByRole('dialog').filter({ hasText: 'Файлы:' });
}

export async function closeFilesModal(page: Page): Promise<void> {
  const modal = filesDialog(page);
  if ((await modal.count()) === 0) return;
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
}

export async function openNotifications(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Уведомления' }).click();
  const drawer = page.getByRole('dialog').filter({ hasText: 'Уведомления' });
  await expect(drawer).toBeVisible();
  return drawer;
}

export async function closeNotifications(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog').filter({ hasText: 'Уведомления' })).toBeHidden();
}

export async function openInvoiceHistory(page: Page, counterparty: string): Promise<Locator> {
  await openInvoiceMenu(page, counterparty, 'История');
  const modal = page.getByRole('dialog').filter({ hasText: 'История:' });
  await expect(modal).toBeVisible();
  return modal;
}

export async function closeDialog(page: Page, text: string): Promise<void> {
  const modal = page.getByRole('dialog').filter({ hasText: text });
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
}

export async function waitForRegistry(page: Page, counterparty: string): Promise<void> {
  await expect(page.getByRole('row').filter({ hasText: counterparty }).first()).toBeVisible({
    timeout: 15_000,
  });
}

export function invoiceRowByNumber(page: Page, invoiceNumber: string): Locator {
  return page.getByRole('row').filter({ hasText: invoiceNumber }).first();
}

export function invoiceRowByAmount(
  page: Page,
  counterparty: string,
  amount: RegExp,
): Locator {
  return page
    .getByRole('row')
    .filter({ hasText: counterparty })
    .filter({ hasText: amount })
    .first();
}

export async function markPartialPayment(
  page: Page,
  row: Locator,
  amount: string,
  comment: string,
): Promise<void> {
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Частично', exact: true }).click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Частичная оплата' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Сумма к оплате').fill(amount);
  await modal.getByLabel('Комментарий к оплате').fill(comment);
  await modal.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Частичная оплата отмечена')).toBeVisible();
  await expect(modal).toBeHidden();
}

export async function markForApproval(page: Page, row: Locator): Promise<void> {
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Согласование', exact: true }).click();
  await expect(page.getByText('Счёт отправлен на согласование')).toBeVisible();
}

export async function clearPaymentMark(page: Page, row: Locator): Promise<void> {
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Убрать отметку' }).first().click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Снятие отметки' });
  await modal.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByText('Отметка удалена')).toBeVisible();
}

export async function payInvoice(page: Page, row: Locator, amount: string): Promise<void> {
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Оплатить', exact: true }).click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Оплата счёта' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Сумма к оплате').fill(amount);
  await modal.getByRole('button', { name: 'Оплатить', exact: true }).click();
  await expect(page.getByText('Статус счёта обновлён')).toBeVisible();
  await expect(modal).toBeHidden();
}

export async function clearInvoicePayment(page: Page, row: Locator): Promise<void> {
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Снять оплату' }).first().click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Снятие оплаты' });
  await modal.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByText('Оплата снята')).toBeVisible();
}

export async function deleteInvoiceViaMenu(page: Page, row: Locator): Promise<void> {
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Действия со счётом' }).first().click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Удалить', exact: true }).click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Удаление счёта' });
  await modal.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(row).toHaveCount(0);
}

export async function createUserViaAdmin(
  page: Page,
  data: { name: string; login: string; password: string; orgName: string; role: string },
): Promise<void> {
  await page.getByRole('tab', { name: 'Пользователи' }).click();
  await page.getByRole('button', { name: 'Добавить пользователя' }).click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Добавить пользователя' });
  await modal.getByLabel('Имя').fill(data.name);
  await modal.getByLabel('Логин').fill(data.login);
  await modal.getByLabel('Пароль').fill(data.password);
  await modal.getByRole('button', { name: 'Добавить организацию' }).click();
  await modal.getByLabel('Организация').click();
  await page.getByRole('option', { name: data.orgName, exact: true }).click();
  await modal.getByRole('textbox', { name: 'Роль', exact: true }).click();
  await page.getByRole('option', { name: data.role, exact: true }).click();
  await modal.getByRole('button', { name: 'Создать пользователя' }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: data.login }).first()).toBeVisible();
}

export async function assignObjectsViaAdmin(
  page: Page,
  userLogin: string,
  orgName: string,
  objectNames: string[],
): Promise<void> {
  const userRow = page.getByRole('row').filter({ hasText: userLogin }).first();
  const assignmentRow = userRow.getByRole('row').filter({ hasText: orgName }).first();
  await assignmentRow.locator('td').nth(2).getByRole('button').first().click();
  const popover = page.locator('.mantine-Popover-dropdown:visible').last();
  for (const objectName of objectNames) {
    await popover.getByRole('checkbox', { name: objectName, exact: true }).check();
  }
  await popover.getByRole('button', { name: 'Сохранить' }).click();
  await expect(popover).toBeHidden();
}

function columnSettingsModal(page: Page): Locator {
  return page.getByRole('dialog').filter({ hasText: 'Настройка колонок' });
}

async function saveColumnSettings(page: Page, modal: Locator): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await modal.getByRole('button', { name: 'Сохранить' }).click();
    if (await modal.isHidden()) return;
    await page.waitForTimeout(500);
  }
  throw new Error('Настройки колонок не сохранились');
}

export async function setColumnVisible(
  page: Page,
  columnLabel: string,
  visible: boolean,
): Promise<void> {
  await page.locator('button[aria-label="Настройка колонок"]:visible').first().click();
  const modal = columnSettingsModal(page);
  await expect(modal).toBeVisible();
  const checkbox = modal.getByRole('checkbox', { name: columnLabel, exact: true });
  if ((await checkbox.isChecked()) !== visible) await checkbox.click();
  await saveColumnSettings(page, modal);
}

export async function dragColumnBefore(
  page: Page,
  columnLabel: string,
  beforeLabel: string,
): Promise<string[]> {
  await page.locator('button[aria-label="Настройка колонок"]:visible').first().click();
  const modal = columnSettingsModal(page);
  await expect(modal).toBeVisible();
  const labels = async () =>
    (await modal.locator('.mantine-Checkbox-label').allInnerTexts()).map((text) => text.trim());

  const sortableItem = (label: string) =>
    modal
      .getByRole('checkbox', { name: label, exact: true })
      .locator('xpath=ancestor::*[@role="button"][1]');
  const source = sortableItem(columnLabel);
  const target = sortableItem(beforeLabel);
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('Колонки не найдены в настройках');

  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 12;
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(startX, startY + ((to.y - from.y) * step) / steps);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();

  const order = await labels();
  await saveColumnSettings(page, modal);
  return order;
}

export async function printRegistry(page: Page): Promise<number> {
  await page.evaluate(() => {
    const state = window as unknown as { __printCount?: number };
    state.__printCount = 0;
    window.print = () => {
      state.__printCount = (state.__printCount ?? 0) + 1;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await page.locator('button[aria-label="Печать"]:visible').first().click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __printCount?: number }).__printCount ?? 0))
    .toBeGreaterThan(0);
  return page.evaluate(() => (window as unknown as { __printCount?: number }).__printCount ?? 0);
}

export async function exportExcel(page: Page): Promise<string> {
  const download = page.waitForEvent('download');
  await page.locator('button[aria-label="Экспорт в Excel"]:visible').first().click();
  const file = await download;
  return file.suggestedFilename();
}




export function archiveRow(page: Page, counterparty: string, amount?: RegExp): Locator {
  const rows = page.getByRole('row').filter({ hasText: counterparty });
  return amount ? rows.filter({ hasText: amount }).first() : rows.first();
}

export async function openOrganizationsTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Организации' }).click();
  await expect(page.getByRole('tab', { name: 'Организации' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
}

export async function openArchiveTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Архив счетов' }).click();
  await expect(page.getByRole('heading', { name: 'Архив счетов' })).toBeVisible();
}

export async function viewDeletedInvoiceHistory(
  page: Page,
  counterparty: string,
  expectedTypes: string[],
): Promise<number> {
  const row = archiveRow(page, counterparty);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Просмотреть' }).click();
  const modal = page.getByRole('dialog').filter({ hasText: counterparty });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Контрагент', { exact: true })).toBeVisible();
  await modal.getByRole('tab', { name: 'История' }).click();
  const panel = modal.getByRole('tabpanel');
  await expect(panel).toBeVisible();
  for (const type of expectedTypes) {
    await expect(panel.getByText(type, { exact: true }).first()).toBeVisible();
  }
  const entries = await panel.getByRole('row').count();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  return entries;
}

export async function restoreDeletedInvoice(page: Page, counterparty: string): Promise<void> {
  const row = archiveRow(page, counterparty);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Восстановить' }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'Восстановление счёта' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Восстановить' }).click();
  await expect(confirm).toBeHidden();
  await expect(row).toHaveCount(0);
}

export async function renameUserViaAdmin(
  page: Page,
  currentName: string,
  newName: string,
): Promise<void> {
  await page.getByRole('tab', { name: 'Пользователи' }).click();
  await page.getByRole('button', { name: `Редактировать пользователя ${currentName}` }).click();
  const modal = page.getByRole('dialog').filter({ hasText: `Редактировать пользователя ${currentName}` });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Имя').fill(newName);
  await modal.getByRole('button', { name: 'Сохранить' }).click();
  await expect(modal).toBeHidden();
  await expect(
    page.getByRole('cell', { name: newName, exact: true }).first(),
  ).toBeVisible();
}

export async function renameBankAccount(
  page: Page,
  accountNumber: string,
  newNumber: string,
): Promise<void> {
  const section = page
    .getByText('Расчётные счета', { exact: true })
    .locator('xpath=ancestor::*[.//button][1]');
  const row = section
    .getByText(accountNumber, { exact: true })
    .locator('xpath=ancestor::*[.//button][1]');
  await expect(row).toBeVisible();
  await row.locator('button').first().click();
  const input = section.locator('input:not([placeholder])');
  await expect(input).toBeVisible();
  await input.fill(newNumber);
  await input
    .locator('xpath=ancestor::*[.//button][1]')
    .locator('button')
    .first()
    .click();
  await expect(section.getByText(newNumber, { exact: true })).toBeVisible();
}

export async function changeInvoiceInitiator(
  page: Page,
  counterparty: string,
  initiatorName: string,
): Promise<void> {
  await openInvoiceMenu(page, counterparty, 'Редактировать');
  const modal = page.getByRole('dialog').filter({ hasText: 'Редактирование счёта' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Инициатор').click();
  await page.getByRole('option', { name: initiatorName, exact: true }).click();
  await modal.getByRole('button', { name: 'Сохранить' }).click();
  await expect(modal).toBeHidden();
}

export async function deleteUserViaAdmin(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name: 'Пользователи' }).click();
  await page.getByRole('button', { name: `Удалить пользователя ${name}` }).click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Удаление пользователя' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(0);
}

export async function deleteOrgViaAdmin(page: Page, orgName: string): Promise<void> {
  await openOrganizationsTab(page);
  await page.getByRole('button', { name: `Удалить организацию «${orgName}»` }).click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Удаление организации' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Подтверждающая фраза').fill('я осознаю последствия');
  const confirm = modal.getByRole('button', { name: 'Удалить', exact: true });
  await expect(confirm).toBeEnabled({ timeout: 15_000 });
  await confirm.click({ timeout: 15_000 });
  await expect(modal).toBeHidden({ timeout: 15_000 });
}
