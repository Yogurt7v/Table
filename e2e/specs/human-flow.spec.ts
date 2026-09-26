import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { E2E_PASSWORD } from '../data';
import { pbAdmin } from '../utils/pb';
import { expect, loginViaUi, logoutViaUi, test } from '../fixtures';
import type { HumanFixture } from '../utils/human';
import {
  bootstrapHumanFlow,
  cleanupHumanFlow,
  getAccountNumbersByOrg,
  getInvoicesByCounterparty,
  getInvoiceFiles,
  getMembership,
  getObjectNamesByOrg,
  getInvoicesByOrg,
  getObjectsByOrg,
  getPaymentMarksOf,
  getUserByLogin,
  purgeArchivedInvoices,
  humanAccountNumber,
  humanAmountPattern,
  humanCopyCounterparty,
  humanDateButtonLabel,
  humanInvoiceCounterparty,
  humanIsoDate,
  humanObjectName,
  humanUserName,
} from '../utils/human';
import {
  addInvoiceViaDraft,
  archiveRow,
  assignObjectsViaAdmin,
  clearInvoicePayment,
  changeInvoiceInitiator,
  clearPaymentMark,
  closeDialog,
  closeFilesModal,
  closeNotifications,
  closeOrgModal,
  copyInvoice,
  createUserViaAdmin,
  deleteBankAccount,
  deleteInvoiceFile,
  deleteInvoiceViaMenu,
  deleteObject,
  deleteOrgViaAdmin,
  deleteUserViaAdmin,
  dragColumnBefore,
  editInvoice,
  exportExcel,
  invoiceMenuItems,
  invoiceRow,
  invoiceRowByAmount,
  invoiceRowByNumber,
  markForApproval,
  markPartialPayment,
  moveInvoice,
  moveObject,
  openAdmin,
  openArchiveTab,
  openOrganizationsTab,
  openEditOrgModal,
  openInvoiceHistory,
  openNotifications,
  openRegistry,
  payInvoice,
  printRegistry,
  waitForRegistry,
  registryDateTrigger,
  renameBankAccount,
  renameObject,
  renameUserViaAdmin,
  restoreDeletedInvoice,
  selectOrg,
  setColumnVisible,
  setRegistryDate,
  uploadInvoiceFile,
  viewDeletedInvoiceHistory,
} from '../utils/human-ui';

const AMOUNT_INITIAL = '100000';
const AMOUNT_EDITED = '120000';
const PARTIAL_AMOUNT = '54000';
const MODERATOR_PAYMENT = '66000';
const FILE_BASENAME = 'human-flow-file.txt';

test.describe.serial('Человеческий тест', () => {
  const marker = process.env.HUMAN_MARKER ?? 'HT-RUN';
  let fixture: HumanFixture;
  let tmpDir = '';
  let filePath = '';

  test.describe.configure({ retries: 0 });

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    tmpDir = mkdtempSync(join(tmpdir(), 'human-flow-'));
    filePath = join(tmpDir, FILE_BASENAME);
    writeFileSync(filePath, `проверка файла ${marker}`, 'utf8');
    fixture = await bootstrapHumanFlow(marker);
  });

  test.afterAll(async () => {
    await cleanupHumanFlow(marker);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('человеческий тест: шаги 1-14', async ({ page }) => {
    test.setTimeout(900_000);
    const { orgId, logins, ids, dates } = fixture;
    const orgName = `ХТ-${marker}`;
    const firstObject = humanObjectName(marker, 1);
    const secondObject = humanObjectName(marker, 2);
    const thirdObject = humanObjectName(marker, 3);
    const renamedFirst = `${firstObject} (переименован)`;
    const renamedThird = `${thirdObject} (переименован)`;
    const activeObjects = [secondObject, renamedFirst];
    const counterparty = humanInvoiceCounterparty(marker);
    const copyCounterparty = humanCopyCounterparty(marker);
    const thirdAccount = humanAccountNumber(marker, 3);

    await test.step('1. модератор: переименование, обмен и удаление объектов и счёта', async () => {
      await loginViaUi(page, logins.moderator);
      await openAdmin(page);
      const modal = await openEditOrgModal(page, orgName);

      await renameObject(page, modal, firstObject, renamedFirst);
      await renameObject(page, modal, thirdObject, renamedThird);
      await moveObject(page, modal, secondObject, 'up');
      await deleteObject(page, modal, renamedThird);
      await deleteBankAccount(page, modal, thirdAccount);
      await closeOrgModal(page, modal);

      const objects = await getObjectNamesByOrg(orgId);
      expect(objects).toEqual([secondObject, renamedFirst]);

      const accounts = await getAccountNumbersByOrg(orgId);
      expect(accounts).toHaveLength(2);
      expect(accounts).not.toContain(thirdAccount);

      const membership = await getMembership(ids.moderator, orgId);
      expect(String(membership?.role)).toBe('moderator');
    });

    await test.step('2. пользователь состоит в организации и видит объекты', async () => {
      const membership = await getMembership(ids.user, orgId);
      expect(String(membership?.role)).toBe('user');
      const membershipObjects = (membership?.objects as string[]) ?? [];
      const actualObjects = await getObjectsByOrg(orgId);
      expect(membershipObjects).toEqual(expect.arrayContaining(actualObjects.map((o) => o.id)));
    });

    await test.step('3. пользователь создаёт счёт на дату ровно месяц назад', async () => {
      await logoutViaUi(page);
      await loginViaUi(page, logins.user);
      await setRegistryDate(page, dates.D);

      const target = (await getObjectNamesByOrg(orgId))[0];
      expect(target).toBeTruthy();
      await addInvoiceViaDraft(page, String(target), {
        counterparty,
        purpose: 'Оплата по договору',
        contractNo: `Д-${marker}`,
        invoiceNo: `№${marker}`,
        amount: AMOUNT_INITIAL,
      });

      const invoices = await getInvoicesByCounterparty(counterparty, orgId);
      expect(invoices).toHaveLength(1);
      expect(humanIsoDate(invoices[0]?.date)).toBe(dates.D);
      expect(Number(invoices[0]?.amount)).toBe(Number(AMOUNT_INITIAL));
      expect(String(invoices[0]?.created_by)).toBe(ids.user);
    });

    await test.step('4. редактирование, перенос, копия, файл и комментарий', async () => {
      await editInvoice(page, counterparty, { amount: AMOUNT_EDITED });
      const [edited] = await getInvoicesByCounterparty(counterparty, orgId);
      expect(Number(edited?.amount)).toBe(Number(AMOUNT_EDITED));

      const userMenu = await invoiceMenuItems(page, counterparty);
      expect(userMenu).not.toContain('Перенести');

      const objects = await getObjectsByOrg(orgId);
      const targetObject = objects.find((o) => o.id !== edited?.accounting_object_id);
      expect(targetObject).toBeTruthy();

      await logoutViaUi(page);
      await loginViaUi(page, logins.moderator);
      await setRegistryDate(page, dates.D);
      expect(await invoiceMenuItems(page, counterparty)).toContain('Перенести');
      await moveInvoice(page, counterparty, String(targetObject?.name));
      const [moved] = await getInvoicesByCounterparty(counterparty, orgId);
      expect(moved?.accounting_object_id).toBe(targetObject?.id);

      await logoutViaUi(page);
      await loginViaUi(page, logins.user);
      await setRegistryDate(page, dates.D);

      await copyInvoice(page, counterparty, {
        counterparty: copyCounterparty,
        invoiceNo: `№К${marker}`,
        amount: AMOUNT_EDITED,
      });
      const copies = await getInvoicesByCounterparty(copyCounterparty, orgId);
      expect(copies).toHaveLength(1);
      expect(Number(copies[0]?.amount)).toBe(Number(AMOUNT_EDITED));
      expect(copies[0]?.accounting_object_id).toBe(targetObject?.id);

      const invoiceId = String(moved?.id);
      await uploadInvoiceFile(page, counterparty, filePath);
      await expect
        .poll(async () => (await getInvoiceFiles(invoiceId)).length)
        .toBe(1);

      await deleteInvoiceFile(page, counterparty, FILE_BASENAME);
      await expect
        .poll(async () => (await getInvoiceFiles(invoiceId)).length)
        .toBe(0);

      await uploadInvoiceFile(page, counterparty, filePath);
      await expect
        .poll(async () => (await getInvoiceFiles(invoiceId)).length)
        .toBe(1);
      const files = await getInvoiceFiles(invoiceId);
      expect(files[0]?.name).toBe(FILE_BASENAME);
      await closeFilesModal(page);

      await editInvoice(page, counterparty, { comment: `Комментарий ${marker}` });
      const [commented] = await getInvoicesByCounterparty(counterparty, orgId);
      expect(String(commented?.comment)).toBe(`Комментарий ${marker}`);

      await expect(invoiceRow(page, counterparty)).toBeVisible();
    });

    await test.step('5. администратор проверяет уведомления и историю счёта', async () => {
      await logoutViaUi(page);
      await loginViaUi(page, logins.admin);
      await selectOrg(page, orgName);

      const drawer = await openNotifications(page);
      await expect(drawer.getByText(`Создан счёт: ${counterparty}`)).toBeVisible();
      await expect(drawer.getByText(`Счёт изменён: ${counterparty}`).first()).toBeVisible();
      await expect(drawer.getByText(humanUserName(marker, 'user')).first()).toBeVisible();

      await drawer.getByText(`Создан счёт: ${counterparty}`).click();
      await expect(drawer).toBeHidden();
      await expect(registryDateTrigger(page)).toHaveText(humanDateButtonLabel(dates.D));
      await expect(invoiceRow(page, counterparty).first()).toBeVisible();

      const history = await openInvoiceHistory(page, counterparty);
      await expect(history.getByText('Изменены поля счёта').first()).toBeVisible();
      await expect(history.getByText(/Сумма: 100/).first()).toBeVisible();
      await expect(
        history.getByText(`Комментарий: — → Комментарий ${marker}`).first(),
      ).toBeVisible();
      await expect(history.getByText(`Прикреплён файл «${FILE_BASENAME}»`).first()).toBeVisible();
      await expect(history.getByText(`Удалён файл «${FILE_BASENAME}»`)).toBeVisible();
      await expect(history.getByText(humanUserName(marker, 'user')).first()).toBeVisible();
      await closeDialog(page, 'История:');
    });

    await test.step('6. администратор создаёт босса для организации', async () => {
      await openAdmin(page);
      await createUserViaAdmin(page, {
        name: humanUserName(marker, 'boss'),
        login: logins.boss,
        password: E2E_PASSWORD,
        orgName,
        role: 'Босс',
      });

      const boss = await getUserByLogin(logins.boss);
      ids.boss = boss.id;
      await assignObjectsViaAdmin(page, logins.boss, orgName, activeObjects);

      const membership = await getMembership(boss.id, orgId);
      expect(String(membership?.role)).toBe('boss');
      const orgObjectIds = (await getObjectsByOrg(orgId)).map((o) => o.id).sort();
      expect(((membership?.objects as string[]) ?? []).slice().sort()).toEqual(orgObjectIds);
    });

    await test.step('7. босс отмечает частичную оплату 45% на дату +7', async () => {
      await logoutViaUi(page);
      await loginViaUi(page, logins.boss);
      await selectOrg(page, orgName);
      await setRegistryDate(page, dates.D7);

      const row = invoiceRow(page, counterparty).first();
      await expect(row).toBeVisible();
      await expect(row.getByRole('button', { name: 'Частично', exact: true })).toBeVisible();

      await markPartialPayment(page, row, PARTIAL_AMOUNT, `Частичная оплата ${marker}`);

      const [invoice] = await getInvoicesByCounterparty(counterparty, orgId);
      const marks = await getPaymentMarksOf(String(invoice?.id));
      expect(marks).toHaveLength(1);
      expect(Number(marks[0]?.amount)).toBe(Number(PARTIAL_AMOUNT));
      expect(String(marks[0]?.status)).toBe('partial');
      expect(invoice?.paid).toBeFalsy();
      await expect(invoiceRow(page, counterparty).first().getByText(/Частично: 54/)).toBeVisible();
    });

    await test.step('8. модератор оплачивает остаток по указу и проверяет остаток счёта', async () => {
      await logoutViaUi(page);
      await loginViaUi(page, logins.moderator);
      await selectOrg(page, orgName);
      await setRegistryDate(page, dates.D7);

      await payInvoice(page, invoiceRow(page, counterparty).first(), MODERATOR_PAYMENT);

      await expect
        .poll(async () => (await getInvoicesByCounterparty(counterparty, orgId)).length)
        .toBe(2);
      const invoices = await getInvoicesByCounterparty(counterparty, orgId);
      const original = invoices.find((inv) => !inv.original_invoice_id);
      const remainder = invoices.find((inv) => inv.original_invoice_id);
      expect(String(original?.id)).toBeTruthy();
      expect(original?.paid).toBe(true);
      expect((original?.payment_amounts as number[]) ?? []).toEqual([Number(MODERATOR_PAYMENT)]);
      expect(humanIsoDate(original?.paid_date)).toBe(dates.D7);
      expect(Number(remainder?.amount)).toBe(
        Number(AMOUNT_EDITED) - Number(MODERATOR_PAYMENT),
      );
      expect(humanIsoDate(remainder?.date)).toBe(dates.D7);
      expect(remainder?.paid).toBeFalsy();
      expect(String(remainder?.original_invoice_id)).toBe(String(original?.id));
      expect(await getPaymentMarksOf(String(original?.id))).toHaveLength(0);

      await setRegistryDate(page, dates.today);
      await expect(invoiceRowByAmount(page, counterparty, humanAmountPattern(54000))).toBeVisible();
      await expect(invoiceRow(page, counterparty).filter({ hasText: humanAmountPattern(66000) })).toHaveCount(0);
    });

    await test.step('9. пользователь проверяет даты, колонки, печать и Excel', async () => {
      await logoutViaUi(page);
      await loginViaUi(page, logins.user);
      await selectOrg(page, orgName);

      await setRegistryDate(page, dates.D);
      await expect(invoiceRowByAmount(page, counterparty, humanAmountPattern(120000))).toBeVisible();
      await expect(invoiceRowByAmount(page, counterparty, humanAmountPattern(54000))).toHaveCount(0);

      await setRegistryDate(page, dates.D7);
      await expect(invoiceRowByAmount(page, counterparty, humanAmountPattern(66000))).toBeVisible();
      await expect(invoiceRowByAmount(page, counterparty, humanAmountPattern(54000))).toBeVisible();

      await setRegistryDate(page, dates.D8);
      await expect(invoiceRow(page, counterparty).filter({ hasText: humanAmountPattern(66000) })).toHaveCount(0);
      await expect(invoiceRowByAmount(page, counterparty, humanAmountPattern(54000))).toBeVisible();

      await setRegistryDate(page, dates.today);
      await setColumnVisible(page, 'Комментарий', false);
      await expect(page.getByRole('columnheader', { name: 'Комментарий' })).toHaveCount(0);
      await setColumnVisible(page, 'Комментарий', true);
      await expect(page.getByRole('columnheader', { name: 'Комментарий' }).first()).toBeVisible();

      const order = await dragColumnBefore(page, 'Инициатор', 'Контрагент');
      expect(order).toContain('Инициатор');
      expect(order.indexOf('Инициатор')).toBeLessThan(order.indexOf('Контрагент'));
      await expect(page.getByRole('columnheader', { name: 'Инициатор' }).first()).toBeVisible();

      expect(await printRegistry(page)).toBeGreaterThan(0);
      expect(await exportExcel(page)).toContain('.xlsx');
    });

    await test.step('10. босс помечает остаток счёта на согласование', async () => {
      await logoutViaUi(page);
      await loginViaUi(page, logins.boss);
      await selectOrg(page, orgName);
      await setRegistryDate(page, dates.D9);

      const remainder = invoiceRowByAmount(page, counterparty, humanAmountPattern(54000));
      await expect(remainder).toBeVisible();
      await markForApproval(page, remainder);

      const invoices = await getInvoicesByCounterparty(counterparty, orgId);
      const remainderRecord = invoices.find((inv) => inv.original_invoice_id);
      const marks = await getPaymentMarksOf(String(remainderRecord?.id));
      expect(marks).toHaveLength(1);
      expect(String(marks[0]?.status)).toBe('proposed');
      expect(Number(marks[0]?.amount)).toBe(Number(AMOUNT_EDITED) - Number(MODERATOR_PAYMENT));
      await expect(
        invoiceRowByAmount(page, counterparty, humanAmountPattern(54000)).getByText(/Согласование/),
      ).toBeVisible();
    });

    await test.step('11. модератор проверяет уведомления, снимает отметку, оплачивает и удаляет', async () => {
      await logoutViaUi(page);
      await loginViaUi(page, logins.moderator);
      await selectOrg(page, orgName);
      await setRegistryDate(page, dates.D9);

      const drawer = await openNotifications(page);
      await expect(drawer.getByText('Создан счёт').first()).toBeVisible();
      await expect(drawer.getByText('Счёт изменён').first()).toBeVisible();
      await expect(drawer.getByText('Отметка об оплате').first()).toBeVisible();
      await expect(drawer.getByText('Счёт оплачен')).toHaveCount(0);
      await closeNotifications(page);

      const remainderRow = invoiceRowByAmount(page, counterparty, humanAmountPattern(54000));
      await expect(remainderRow.getByText(/Согласование/)).toBeVisible();
      await clearPaymentMark(page, remainderRow);
      const invoicesAfterMark = await getInvoicesByCounterparty(counterparty, orgId);
      const remainderId = String(
        invoicesAfterMark.find((inv) => inv.original_invoice_id)?.id,
      );
      expect(await getPaymentMarksOf(remainderId)).toHaveLength(0);

      await payInvoice(page, remainderRow, String(Number(AMOUNT_EDITED) - Number(MODERATOR_PAYMENT)));
      const paidRemainder = (await getInvoicesByCounterparty(counterparty, orgId)).find(
        (inv) => inv.id === remainderId,
      );
      expect(paidRemainder?.paid).toBe(true);
      expect(humanIsoDate(paidRemainder?.paid_date)).toBe(dates.D9);

      await clearInvoicePayment(page, invoiceRowByAmount(page, counterparty, humanAmountPattern(54000)));
      const clearedRemainder = (await getInvoicesByCounterparty(counterparty, orgId)).find(
        (inv) => inv.id === remainderId,
      );
      expect(clearedRemainder?.paid).toBe(false);
      expect((clearedRemainder?.payment_amounts as number[]) ?? []).toHaveLength(0);

      await deleteInvoiceViaMenu(page, invoiceRowByAmount(page, counterparty, humanAmountPattern(54000)));
      const left = await getInvoicesByCounterparty(counterparty, orgId);
      expect(left).toHaveLength(1);
      expect(String(left[0]?.id)).toBe(String(invoicesAfterMark.find((inv) => !inv.original_invoice_id)?.id));
    });

    await test.step('12. администратор находит счёт в архиве, смотрит историю и восстанавливает', async () => {
      await logoutViaUi(page);
      await loginViaUi(page, logins.admin);
      await openAdmin(page);
      await openArchiveTab(page);

      const archived = archiveRow(page, counterparty, humanAmountPattern(54000));
      await expect(archived).toBeVisible();
      await expect(archived.getByText(humanUserName(marker, 'moderator'), { exact: true })).toBeVisible();

      const entries = await viewDeletedInvoiceHistory(page, counterparty, [
        'Частично оплачен',
        'Отметка создана',
        'Отметка удалена',
        'Счёт удалён',
      ]);
      expect(entries).toBe(7);

      await restoreDeletedInvoice(page, counterparty);
      await expect
        .poll(async () => (await getInvoicesByCounterparty(counterparty, orgId)).length)
        .toBe(2);
      const restored = (await getInvoicesByCounterparty(counterparty, orgId)).find(
        (inv) => inv.original_invoice_id,
      );
      expect(Number(restored?.amount)).toBe(
        Number(AMOUNT_EDITED) - Number(MODERATOR_PAYMENT),
      );
      expect(restored?.paid).toBeFalsy();
    });

    await test.step('13. администратор проверяет уведомления, переименовывает и меняет инициатора', async () => {
      await openAdmin(page);
      const drawer = await openNotifications(page);
      await expect(drawer.getByText('Счёт оплачен').first()).toBeVisible();
      await expect(drawer.getByText('Счёт удалён').first()).toBeVisible();
      await expect(drawer.getByText('Отметка об оплате').first()).toBeVisible();
      await closeNotifications(page);

      const userName = humanUserName(marker, 'user');
      const renamedUser = `${userName} (переименован)`;
      await renameUserViaAdmin(page, userName, renamedUser);
      expect(String((await getUserByLogin(logins.user)).name)).toBe(renamedUser);

      await openOrganizationsTab(page);
      const orgModal = await openEditOrgModal(page, orgName);
      const [firstAccount, secondAccount] = await getAccountNumbersByOrg(orgId);
      await renameBankAccount(page, String(firstAccount), humanAccountNumber(marker, 11));
      await renameBankAccount(page, String(secondAccount), humanAccountNumber(marker, 12));
      const accountNumbers = await getAccountNumbersByOrg(orgId);
      expect(accountNumbers).toContain(humanAccountNumber(marker, 11));
      expect(accountNumbers).toContain(humanAccountNumber(marker, 12));

      const objectNames = await getObjectNamesByOrg(orgId);
      for (const name of objectNames) {
        await renameObject(page, orgModal, name, `${name} (итог)`);
      }
      await closeOrgModal(page, orgModal);
      const renamedObjects = await getObjectNamesByOrg(orgId);
      expect(renamedObjects.sort()).toEqual(objectNames.map((n) => `${n} (итог)`).sort());

      const invoices = await getInvoicesByOrg(orgId);
      const lastCreated = [...invoices]
        .sort((a, b) => String(a.created).localeCompare(String(b.created)))
        .at(-1);
      const lastCreatedRow = invoiceRowByNumber(page, String(lastCreated?.invoice_no));
      await openRegistry(page);
      await selectOrg(page, orgName);
      await setRegistryDate(page, dates.today);
      await waitForRegistry(page, String(lastCreated?.counterparty));
      await expect(lastCreatedRow).toBeVisible({ timeout: 30_000 });
      await changeInvoiceInitiator(page, String(lastCreated?.counterparty), humanUserName(marker, 'admin'));
      const withInitiator = (await getInvoicesByCounterparty(String(lastCreated?.counterparty), orgId)).find(
        (inv) => inv.id === lastCreated?.id,
      );
      expect(String(withInitiator?.created_by)).toBe(String(ids.admin));
      expect(String(withInitiator?.created_by_name)).toBe(humanUserName(marker, 'admin'));
    });

    await test.step('14. удаление счетов, босса, объектов и организации', async () => {
      const orgInvoices = await getInvoicesByOrg(orgId);
      expect(orgInvoices.length).toBeGreaterThan(0);

      await openRegistry(page);
      await selectOrg(page, orgName);
      for (const invoice of orgInvoices) {
        await setRegistryDate(page, humanIsoDate(invoice.date));
        await waitForRegistry(page, String(invoice.counterparty));
        await deleteInvoiceViaMenu(
          page,
          invoiceRowByAmount(
            page,
            String(invoice.counterparty),
            humanAmountPattern(invoice.amount),
          ),
        );
      }
      await expect.poll(async () => (await getInvoicesByOrg(orgId)).length).toBe(0);

      await openAdmin(page);
      await deleteUserViaAdmin(page, humanUserName(marker, 'boss'));
      await expect.poll(async () => getUserByLogin(logins.boss).catch(() => null)).toBeNull();

      await openOrganizationsTab(page);
      const orgModal = await openEditOrgModal(page, orgName);
      for (const accountNumber of await getAccountNumbersByOrg(orgId)) {
        await deleteBankAccount(page, orgModal, String(accountNumber));
      }
      await expect.poll(async () => (await getAccountNumbersByOrg(orgId)).length).toBe(0);
      expect(await purgeArchivedInvoices(orgId)).toBeGreaterThan(0);
      for (const name of await getObjectNamesByOrg(orgId)) {
        await deleteObject(page, orgModal, name);
      }
      await closeOrgModal(page, orgModal);
      await expect.poll(async () => (await getObjectNamesByOrg(orgId)).length).toBe(0);

      await deleteOrgViaAdmin(page, orgName);
      await expect
        .poll(async () =>
          pbAdmin()
            .collection('organizations')
            .getFullList({ filter: `name = "${orgName}"` })
            .then((rows) => rows.length),
        )
        .toBe(0);
    });
  });
});
