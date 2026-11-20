import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportInvoicesToExcel } from './exportInvoicesToExcel';
import type { ExportInvoicesParams } from './exportInvoicesToExcel';
import type {
  IAccountingObject,
  IInvoice,
  IPaymentMark,
  InvoiceColumnId,
  IUser,
} from '@/shared/types';
import { accObj1, accObj2, adminUser, invoice1, invoice2, invoice3 } from '@/mocks/seed';

// ---------------------------------------------------------------------------
// `xlsx` целиком замокан: реальный `writeFile` пишет файл на диск, а
// `aoa_to_sheet` мы не подменяем заглушкой — мы *перехватываем* его аргумент,
// потому что этот массив массивов и есть весь контент выгрузки.
// ---------------------------------------------------------------------------
const xlsxSpy = vi.hoisted(() => ({
  sheets: [] as unknown[][][],
  appended: [] as { name: unknown; cols: unknown }[],
  writeFile: vi.fn(),
}));

vi.mock('xlsx', () => ({
  utils: {
    book_new: () => ({}),
    book_append_sheet: (_workbook: unknown, sheet: Record<string, unknown>, name: string) => {
      xlsxSpy.appended.push({ name, cols: sheet['!cols'] });
    },
    aoa_to_sheet: (data: unknown[][]) => {
      xlsxSpy.sheets.push(data);
      return {} as Record<string, unknown>;
    },
  },
  writeFile: xlsxSpy.writeFile,
}));

/** Неразрывный пробел, который `toLocaleString('ru-RU')` ставит между разрядами. */
const NBSP = '\u00a0';

const ORG_NAME = 'ООО "Тест"';

const BASE_PARAMS: ExportInvoicesParams = {
  invoices: [],
  objects: [accObj1],
  date: '2026-06-01',
  visibleColumns: ['counterparty', 'amount'],
  canViewPaymentMarks: true,
  canViewPaidDate: true,
  orgName: ORG_NAME,
  usersMap: new Map<string, IUser>([['admin1', adminUser]]),
};

function invoice(partial: Partial<IInvoice> = {}): IInvoice {
  return {
    id: 'inv-x',
    organization_id: 'org1',
    accounting_object_id: accObj1.id,
    date: '2026-06-01',
    seq: 1,
    counterparty: 'ООО "Ромашка"',
    purpose: 'Аренда помещения',
    contract_no: 'Д-1',
    invoice_no: 'СФ-1',
    amount: 1000,
    paid: false,
    paid_amount: null,
    payment_amounts: [],
    paid_date: '',
    comment: '',
    copy_comments: {},
    created_by: 'admin1',
    updated_by: 'admin1',
    created_by_name: 'Админ',
    updated_by_name: 'Админ',
    source_paid_amount: 0,
    source_paid_date: '',
    created: '2026-06-01T09:00:00Z',
    ...partial,
  };
}

function mark(partial: Partial<IPaymentMark>): IPaymentMark {
  return {
    id: 'pm1',
    invoice_id: 'inv-x',
    organization_id: 'org1',
    amount: null,
    comment: '',
    status: undefined,
    created_by: 'admin1',
    created: '2026-06-02',
    ...partial,
  };
}

/** Вызывает экспорт и возвращает перехваченную матрицу листа. */
function runExport(overrides: Partial<ExportInvoicesParams> = {}): unknown[][] {
  exportInvoicesToExcel({ ...BASE_PARAMS, ...overrides });

  const data = xlsxSpy.sheets.at(-1);
  expect(data).toBeDefined();
  return data ?? [];
}

/**
 * Первая строка счёта: 0 — организация, 1 — дата, 2 — пустая, 3 — объект,
 * 4 — шапка колонок, 5 — первый счёт.
 */
function firstInvoiceRow(overrides: Partial<ExportInvoicesParams> = {}): unknown[] {
  return runExport(overrides)[5] ?? [];
}

/** Ячейки строки счёта, адресованные по id колонки (без колонки «№»). */
function cells(
  visibleColumns: InvoiceColumnId[],
  overrides: Partial<ExportInvoicesParams> = {},
): Record<string, unknown> {
  const row = firstInvoiceRow({ ...overrides, visibleColumns });
  const result: Record<string, unknown> = {};
  visibleColumns.forEach((colId, index) => {
    result[colId] = row[index + 1];
  });
  return result;
}

describe('exportInvoicesToExcel', () => {
  beforeEach(() => {
    xlsxSpy.sheets.length = 0;
    xlsxSpy.appended.length = 0;
    xlsxSpy.writeFile.mockClear();
  });

  describe('матрица листа', () => {
    it('собирает шапку организации, объекты, счета, разделители и строку итога', () => {
      const data = runExport({
        invoices: [invoice1, invoice2, invoice3],
        objects: [accObj1, accObj2],
        visibleColumns: ['counterparty', 'invoice_no', 'amount', 'paid', 'comment'],
      });

      expect(data).toEqual([
        [ORG_NAME],
        ['01.06.2026'],
        [],
        ['Основная деятельность'],
        ['№', 'Контрагент', 'Счёт', 'Сумма', 'Оплачено', 'Комментарий'],
        [1, 'ООО "Контрагент А"', 'СФ-001', `50${NBSP}000,00 ₽`, 'Нет', '—'],
        [2, 'ООО "Контрагент А"', 'СФ-002', `30${NBSP}000,00 ₽`, `30${NBSP}000,00 ₽`, '—'],
        [],
        ['Капитальные вложения'],
        ['№', 'Контрагент', 'Счёт', 'Сумма', 'Оплачено', 'Комментарий'],
        [1, 'ООО "Поставщик Б"', 'СФ-003', `120${NBSP}000,00 ₽`, 'Нет', 'Срочно'],
        [],
        [`Итого по всем объектам: 170${NBSP}000,00 ₽`],
      ]);
    });

    it('нумерует счета заново в каждом объекте', () => {
      const data = runExport({
        invoices: [invoice1, invoice2, invoice3],
        objects: [accObj1, accObj2],
        visibleColumns: ['amount'],
      });

      expect(data.slice(3)).toEqual([
        ['Основная деятельность'],
        ['№', 'Сумма'],
        [1, `50${NBSP}000,00 ₽`],
        [2, `30${NBSP}000,00 ₽`],
        [],
        ['Капитальные вложения'],
        ['№', 'Сумма'],
        [1, `120${NBSP}000,00 ₽`],
        [],
        [`Итого по всем объектам: 170${NBSP}000,00 ₽`],
      ]);
    });

    it('не добавляет объект, у которого нет счетов', () => {
      const data = runExport({
        invoices: [invoice1],
        objects: [accObj1, accObj2],
        visibleColumns: ['amount'],
      });

      expect(data.flat().some((cell) => String(cell).includes('Капитальные вложения'))).toBe(false);
      expect(data).toEqual([
        [ORG_NAME],
        ['01.06.2026'],
        [],
        ['Основная деятельность'],
        ['№', 'Сумма'],
        [1, `50${NBSP}000,00 ₽`],
        [],
        [`Итого по всем объектам: 50${NBSP}000,00 ₽`],
      ]);
    });

    it('ставит ширину 5 для «№» и 24 для каждой колонки', () => {
      runExport({
        invoices: [invoice1],
        objects: [accObj1],
        visibleColumns: ['counterparty', 'amount', 'paid'],
      });

      expect(xlsxSpy.appended).toHaveLength(1);
      expect(xlsxSpy.appended[0]?.cols).toEqual([
        { wch: 5 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
      ]);
    });

    it('добавляет лист на одну книгу и сохраняет файл ровно один раз', () => {
      runExport({ invoices: [invoice1] });

      expect(xlsxSpy.sheets).toHaveLength(1);
      expect(xlsxSpy.writeFile).toHaveBeenCalledTimes(1);
      expect(xlsxSpy.appended[0]?.name).toBe('Счета');
    });
  });

  describe('содержимое ячеек', () => {
    it('у оплаченного счёта показывает в «Оплачено» сумму платежей, а не сумму счёта', () => {
      const result = cells(['amount', 'paid'], {
        invoices: [
          invoice({
            paid: true,
            paid_amount: 60000,
            amount: 100000,
            payment_amounts: [60000],
          }),
        ],
      });

      // Сумма счёта 100 000 ₽ — её в «Оплачено» быть не должно ни при каких условиях.
      expect(result.paid).toBe(`60${NBSP}000,00 ₽`);
      expect(result.paid).not.toBe(`100${NBSP}000,00 ₽`);
      expect(result.amount).toBe(`60${NBSP}000,00 ₽`);
    });

    it('суммирует несколько платежей оплаченного счёта', () => {
      const result = cells(['paid'], {
        invoices: [invoice({ paid: true, amount: 100000, payment_amounts: [40000, 35000, 25000] })],
      });

      expect(result.paid).toBe(`100${NBSP}000,00 ₽`);
    });

    it('у оплаченного счёта без записанных платежей пишет «0,00 ₽» — фактическое поведение', () => {
      // `payment_amounts?.reduce(...) ?? invoice.amount`: пустой массив даёт 0, а не
      // undefined, поэтому запасной вариант не срабатывает. Пиню как есть.
      const result = cells(['amount', 'paid'], {
        invoices: [invoice({ paid: true, paid_amount: 40000, amount: 40000, payment_amounts: [] })],
      });

      expect(result.paid).toBe('0,00 ₽');
      expect(result.amount).toBe(`40${NBSP}000,00 ₽`);
    });

    it('у неоплаченного счёта в «Оплачено» пишет «Нет»', () => {
      const result = cells(['paid'], {
        invoices: [invoice({ paid: false, amount: 50000 })],
      });

      expect(result.paid).toBe('Нет');
    });

    it('в «Сумма» у неоплаченного счёта пишет базовую сумму, несмотря на частичные платежи', () => {
      const result = cells(['amount'], {
        invoices: [invoice({ paid: false, amount: 50000, payment_amounts: [20000] })],
      });

      expect(result.amount).toBe(`50${NBSP}000,00 ₽`);
    });

    it('в «Сумма» у оплаченного счёта пишет сумму платежей', () => {
      const result = cells(['amount'], {
        invoices: [invoice({ paid: true, amount: 50000, payment_amounts: [41000, 9000] })],
      });

      expect(result.amount).toBe(`50${NBSP}000,00 ₽`);
    });

    it('подставляет прочерк вместо пустых договора, даты оплаты и комментария', () => {
      const result = cells(['contract_no', 'paid_date', 'comment'], {
        invoices: [invoice({ contract_no: '', paid_date: '', comment: '' })],
      });

      expect(result).toEqual({ contract_no: '—', paid_date: '—', comment: '—' });
    });

    it('переносит заполненные договор, дату оплаты и комментарий без изменений', () => {
      const result = cells(['contract_no', 'paid_date', 'comment'], {
        invoices: [
          invoice({ paid: true, paid_date: '2026-06-02', contract_no: 'Д-77', comment: 'срочно' }),
        ],
      });

      expect(result).toEqual({
        contract_no: 'Д-77',
        paid_date: '2026-06-02',
        comment: 'срочно',
      });
    });

    it('переносит контрагента, назначение и номер счёта дословно, без прочерка', () => {
      const result = cells(['counterparty', 'purpose', 'invoice_no'], {
        invoices: [invoice({ purpose: '', invoice_no: 'СФ-9' })],
      });

      expect(result).toEqual({
        counterparty: 'ООО "Ромашка"',
        // Пустое назначение платежа остаётся пустой ячейкой, а не «—».
        purpose: '',
        invoice_no: 'СФ-9',
      });
    });

    it('без отметки в «Отметка» пишет прочерк', () => {
      const result = cells(['payment_mark'], {
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [mark({ invoice_id: 'inv-other' })],
      });

      expect(result.payment_mark).toBe('—');
    });

    it('в «Отметка» собирает статус, сумму и комментарий', () => {
      const result = cells(['payment_mark'], {
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [
          mark({ status: 'partial', amount: 12000, comment: 'по договору', invoice_id: 'inv-x' }),
        ],
      });

      expect(result.payment_mark).toBe(`Частично: 12${NBSP}000,00 ₽ (по договору)`);
    });

    it('в «Отметка» без комментария не оставляет пустых скобок', () => {
      const result = cells(['payment_mark'], {
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [
          mark({ status: 'partial', amount: 12000, comment: '', invoice_id: 'inv-x' }),
        ],
      });

      expect(result.payment_mark).toBe(`Частично: 12${NBSP}000,00 ₽`);
    });

    it('в «Отметка» у отметки без суммы пишет сумму счёта', () => {
      const result = cells(['payment_mark'], {
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [mark({ status: 'proposed', amount: null, invoice_id: 'inv-x' })],
      });

      expect(result.payment_mark).toBe(`Согласование: 50${NBSP}000,00 ₽`);
    });

    it('в «Отметка» различает полную оплату и частичную по статусу и сумме', () => {
      const full = cells(['payment_mark'], {
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [mark({ status: 'approved', amount: 50000, invoice_id: 'inv-x' })],
      });
      const legacyFull = cells(['payment_mark'], {
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [mark({ amount: 50000, invoice_id: 'inv-x' })],
      });
      const legacyPartial = cells(['payment_mark'], {
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [mark({ amount: 30000, invoice_id: 'inv-x' })],
      });

      expect(full.payment_mark).toBe(`К оплате: 50${NBSP}000,00 ₽`);
      expect(legacyFull.payment_mark).toBe(`К оплате: 50${NBSP}000,00 ₽`);
      expect(legacyPartial.payment_mark).toBe(`Частично: 30${NBSP}000,00 ₽`);
    });

    it('в «Отметка» берёт последнюю отметку счёта, если их несколько', () => {
      const result = cells(['payment_mark'], {
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [
          mark({ id: 'pm-old', status: 'partial', amount: 10000, invoice_id: 'inv-x' }),
          mark({ id: 'pm-new', status: 'approved', amount: 50000, invoice_id: 'inv-x' }),
        ],
      });

      expect(result.payment_mark).toBe(`К оплате: 50${NBSP}000,00 ₽`);
    });

    it('в «Инициатор» отдаёт приоритет снимку имени над справочником пользователей', () => {
      const result = cells(['initiator'], {
        invoices: [invoice({ created_by: 'admin1', created_by_name: 'Снимок имени' })],
      });

      expect(result.initiator).toBe('Снимок имени');
    });

    it('в «Инициатор» без снимка имени берёт пользователя из справочника', () => {
      const result = cells(['initiator'], {
        invoices: [invoice({ created_by: 'admin1', created_by_name: '' })],
      });

      expect(result.initiator).toBe('Админ');
    });

    it('в «Инициатор» для неизвестного пользователя пишет прочерк', () => {
      const result = cells(['initiator'], {
        invoices: [invoice({ created_by: 'ghost', created_by_name: '' })],
      });

      expect(result.initiator).toBe('—');
    });

    it('для колонки вне HEADER_LABELS печатает id в шапке и пустые ячейки — мёртвая ветка', () => {
      // `InvoiceColumnId` — закрытое объединение, и все его значения либо есть в
      // HEADER_LABELS, либо вырезаются фильтром колонок, поэтому фолбэк недостижим
      // из обычного вызова. Закрепляю его поведение через cast.
      const unknownColumn = 'mystery' as InvoiceColumnId;
      const data = runExport({
        invoices: [invoice()],
        objects: [accObj1],
        visibleColumns: ['counterparty', unknownColumn],
      });

      expect(data[4]).toEqual(['№', 'Контрагент', 'mystery']);
      expect(data[5]).toEqual([1, 'ООО "Ромашка"', '']);
    });
  });

  describe('частичные оплаты: копии платежей и строка остатка', () => {
    it('разворачивает оплаты в копии и добавляет строку остатка', () => {
      const data = runExport({
        invoices: [invoice({ amount: 50000, payment_amounts: [20000, 15000] })],
        objects: [accObj1],
        visibleColumns: ['amount', 'paid'],
      });

      expect(data.slice(3)).toEqual([
        ['Основная деятельность'],
        ['№', 'Сумма', 'Оплачено'],
        [1, `50${NBSP}000,00 ₽`, 'Нет'],
        ['', '', `15${NBSP}000,00 ₽`],
        ['', `Остаток: 15${NBSP}000,00 ₽`, 'Нет'],
        [],
        [`Итого по всем объектам: 50${NBSP}000,00 ₽`],
      ]);
    });

    it('в копиях и остатке повторяет назначение платежа, остальные колонки оставляет пустыми', () => {
      const data = runExport({
        invoices: [
          invoice({
            counterparty: 'ООО "Ромашка"',
            purpose: 'Аренда помещения',
            amount: 50000,
            payment_amounts: [20000, 15000],
          }),
        ],
        objects: [accObj1],
        visibleColumns: ['counterparty', 'purpose', 'amount', 'paid'],
      });

      expect(data.slice(5)).toEqual([
        [1, 'ООО "Ромашка"', 'Аренда помещения', `50${NBSP}000,00 ₽`, 'Нет'],
        ['', '', 'Аренда помещения', '', `15${NBSP}000,00 ₽`],
        ['', '', 'Аренда помещения', `Остаток: 15${NBSP}000,00 ₽`, 'Нет'],
        [],
        [`Итого по всем объектам: 50${NBSP}000,00 ₽`],
      ]);
    });

    it('у оплаченного счёта показывает копии платежей, но не строку остатка', () => {
      const data = runExport({
        invoices: [invoice({ amount: 50000, paid: true, payment_amounts: [20000, 30000] })],
        objects: [accObj1],
        visibleColumns: ['amount', 'paid'],
      });

      expect(data.slice(5)).toEqual([
        [1, `50${NBSP}000,00 ₽`, `50${NBSP}000,00 ₽`],
        ['', '', `30${NBSP}000,00 ₽`],
        [],
        ['Итого по всем объектам: 0,00 ₽'],
      ]);
    });

    it('не добавляет ни копий, ни остатка при одной оплате, покрывающей счёт', () => {
      const data = runExport({
        invoices: [invoice({ amount: 50000, paid: true, payment_amounts: [50000] })],
        objects: [accObj1],
        visibleColumns: ['amount', 'paid'],
      });

      expect(data.slice(5)).toEqual([
        [1, `50${NBSP}000,00 ₽`, `50${NBSP}000,00 ₽`],
        [],
        ['Итого по всем объектам: 0,00 ₽'],
      ]);
    });

    it('не добавляет строку остатка, когда оплата перекрывает сумму счёта', () => {
      const data = runExport({
        invoices: [invoice({ amount: 50000, paid: false, payment_amounts: [60000] })],
        objects: [accObj1],
        visibleColumns: ['amount', 'paid'],
      });

      expect(data.slice(5)).toEqual([
        [1, `50${NBSP}000,00 ₽`, 'Нет'],
        [],
        [`Итого по всем объектам: 50${NBSP}000,00 ₽`],
      ]);
    });

    it('не нумерует копии и остаток: номера продолжаются только по основным счетам', () => {
      const data = runExport({
        invoices: [
          invoice({ id: 'inv-1', amount: 50000, payment_amounts: [20000, 15000] }),
          invoice({ id: 'inv-2', seq: 2, amount: 7000, counterparty: 'ООО "Гвоздь"' }),
        ],
        objects: [accObj1],
        visibleColumns: ['amount', 'paid'],
      });

      const numbers = data.map((row) => row[0]).filter((cell) => typeof cell === 'number');
      expect(numbers).toEqual([1, 2]);
    });
  });

  describe('итоги (unpaidTotal)', () => {
    it('суммирует суммы только неоплаченных счетов', () => {
      const data = runExport({
        invoices: [
          invoice({ id: 'inv-1', amount: 50000 }),
          invoice({ id: 'inv-2', seq: 2, amount: 30000, paid: true, payment_amounts: [30000] }),
        ],
        objects: [accObj1],
        visibleColumns: ['amount'],
      });

      expect(data.at(-1)).toEqual([`Итого по всем объектам: 50${NBSP}000,00 ₽`]);
    });

    it('складывает итоги разных объектов', () => {
      const data = runExport({
        invoices: [
          invoice({ id: 'inv-1', amount: 50000 }),
          invoice({
            id: 'inv-3',
            seq: 3,
            amount: 120000,
            accounting_object_id: accObj2.id,
            counterparty: 'ООО "Поставщик Б"',
          }),
        ],
        objects: [accObj1, accObj2],
        visibleColumns: ['amount'],
      });

      expect(data.at(-1)).toEqual([`Итого по всем объектам: 170${NBSP}000,00 ₽`]);
    });

    it('частично оплаченный неоплаченный счёт даёт в итог полную сумму, а не остаток', () => {
      // Фактическое поведение: строка остатка ниже показывает 30 000 ₽,
      // а в итог идёт 50 000 ₽ — так же, как «ИТОГО» на экране реестра.
      const data = runExport({
        invoices: [invoice({ amount: 50000, paid: false, payment_amounts: [20000] })],
        objects: [accObj1],
        visibleColumns: ['amount', 'paid'],
      });

      expect(data[6]).toEqual(['', `Остаток: 30${NBSP}000,00 ₽`, 'Нет']);
      expect(data.at(-1)).toEqual([`Итого по всем объектам: 50${NBSP}000,00 ₽`]);
    });

    it('округляет копейки при суммировании и не выдаёт хвост float', () => {
      const data = runExport({
        invoices: [
          invoice({ id: 'inv-1', amount: 0.1 }),
          invoice({ id: 'inv-2', seq: 2, amount: 0.2 }),
        ],
        objects: [accObj1],
        visibleColumns: ['amount'],
      });

      expect(data.at(-1)).toEqual(['Итого по всем объектам: 0,30 ₽']);
    });

    it('даёт нулевой итог, когда все счета оплачены', () => {
      const data = runExport({
        invoices: [invoice({ amount: 50000, paid: true, payment_amounts: [50000] })],
        objects: [accObj1],
        visibleColumns: ['amount'],
      });

      expect(data.at(-1)).toEqual(['Итого по всем объектам: 0,00 ₽']);
    });
  });

  describe('выбор и порядок колонок', () => {
    it('печатает колонки в порядке visibleColumns', () => {
      const data = runExport({
        invoices: [invoice()],
        objects: [accObj1],
        visibleColumns: ['amount', 'counterparty'],
      });

      expect(data[4]).toEqual(['№', 'Сумма', 'Контрагент']);
      expect(data[5]).toEqual([1, `1${NBSP}000,00 ₽`, 'ООО "Ромашка"']);
    });

    it('вырезает служебные колонки actions и files', () => {
      const data = runExport({
        invoices: [invoice()],
        objects: [accObj1],
        visibleColumns: ['counterparty', 'actions', 'files', 'amount'],
      });

      expect(data[4]).toEqual(['№', 'Контрагент', 'Сумма']);
      expect(data[5]).toEqual([1, 'ООО "Ромашка"', `1${NBSP}000,00 ₽`]);
      expect(xlsxSpy.appended[0]?.cols).toEqual([{ wch: 5 }, { wch: 24 }, { wch: 24 }]);
    });

    it('вырезает «Отметка» без права видеть отметки', () => {
      const data = runExport({
        invoices: [invoice()],
        objects: [accObj1],
        visibleColumns: ['counterparty', 'payment_mark', 'amount'],
        canViewPaymentMarks: false,
      });

      expect(data[4]).toEqual(['№', 'Контрагент', 'Сумма']);
    });

    it('вырезает «Дата оплаты» без права видеть дату оплаты', () => {
      const data = runExport({
        invoices: [invoice()],
        objects: [accObj1],
        visibleColumns: ['counterparty', 'paid_date', 'amount'],
        canViewPaidDate: false,
      });

      expect(data[4]).toEqual(['№', 'Контрагент', 'Сумма']);
    });

    it('оставляет в файле только колонку «№», если колонки не выбраны', () => {
      const data = runExport({
        invoices: [invoice({ amount: 50000, payment_amounts: [20000, 15000] })],
        objects: [accObj1],
        visibleColumns: [],
      });

      expect(data).toEqual([
        [ORG_NAME],
        ['01.06.2026'],
        [],
        ['Основная деятельность'],
        ['№'],
        [1],
        [''],
        [''],
        [],
        [`Итого по всем объектам: 50${NBSP}000,00 ₽`],
      ]);
      expect(xlsxSpy.appended[0]?.cols).toEqual([{ wch: 5 }]);
      expect(xlsxSpy.writeFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('пустые входные данные', () => {
    it('без счетов оставляет только шапку и нулевой итог', () => {
      const data = runExport({ invoices: [], objects: [accObj1], visibleColumns: ['amount'] });

      expect(data).toEqual([[ORG_NAME], ['01.06.2026'], [], ['Итого по всем объектам: 0,00 ₽']]);
      expect(xlsxSpy.writeFile).toHaveBeenCalledTimes(1);
    });

    it('без объектов не печатает ни одного счёта и даёт нулевой итог', () => {
      const data = runExport({ invoices: [invoice()], objects: [], visibleColumns: ['amount'] });

      expect(data).toEqual([[ORG_NAME], ['01.06.2026'], [], ['Итого по всем объектам: 0,00 ₽']]);
      expect(xlsxSpy.writeFile).toHaveBeenCalledTimes(1);
    });

    it('молча теряет счёт, чей объект учёта не передан в objects', () => {
      // Итог считается по счетам, привязанным к objects, — отсюда нулевая сумма
      // при двух непустых счетах в аргументах.
      const data = runExport({
        invoices: [invoice({ amount: 1000 }), invoice({ id: 'inv-2', seq: 2, amount: 2000 })],
        objects: [accObj2],
        visibleColumns: ['amount'],
      });

      expect(data).toEqual([[ORG_NAME], ['01.06.2026'], [], ['Итого по всем объектам: 0,00 ₽']]);
    });

    it('без переданных отметок в «Отметка» пишет прочерк', () => {
      const result = cells(['payment_mark'], {
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: undefined,
      });

      expect(result.payment_mark).toBe('—');
    });
  });

  describe('имя файла', () => {
    it('подставляет дату в формате YYYY-MM-DD', () => {
      runExport({ objects: [accObj1, accObj2], invoices: [invoice1] });

      expect(xlsxSpy.writeFile.mock.calls[0]?.[1]).toBe('Счета_2026-06-01.xlsx');
    });

    it('добавляет название объекта, когда объект единственный', () => {
      runExport({ objects: [accObj1], invoices: [invoice1] });

      expect(xlsxSpy.writeFile.mock.calls[0]?.[1]).toBe(
        'Счета_Основная деятельность_2026-06-01.xlsx',
      );
    });

    it('добавляет название объекта, даже если у него нет счетов', () => {
      runExport({ objects: [accObj2], invoices: [] });

      expect(xlsxSpy.writeFile.mock.calls[0]?.[1]).toBe(
        'Счета_Капитальные вложения_2026-06-01.xlsx',
      );
    });

    it('заменяет недопустимые в имени файла символы на подчёркивание', () => {
      const obj: IAccountingObject = {
        id: 'ao9',
        organization_id: 'org1',
        name: 'Отдел/Склад [2026]: итог?',
      };
      runExport({ objects: [obj], invoices: [] });

      expect(xlsxSpy.writeFile.mock.calls[0]?.[1]).toBe(
        'Счета_Отдел_Склад _2026__ итог__2026-06-01.xlsx',
      );
    });
  });
});
