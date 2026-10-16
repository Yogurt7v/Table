import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/mocks/test-utils';
import { accObj1, accObj2, adminUser } from '@/mocks/seed';
import { PrintableInvoices } from './PrintableInvoices';
import type { OrgRole } from './invoice-field-access';
import type {
  IAccountingObject,
  IInvoice,
  IPaymentMark,
  InvoiceColumnId,
  IUser,
} from '@/shared/types';

// ---------------------------------------------------------------------------
// Проверяем только сборку данных листа: какие колонки, счета и суммы доходят
// до печати. Вёрстка (@media print, ширины, шрифты) в jsdom не имеет движка
// раскладки, поэтому тестировать её здесь нечего.
// ---------------------------------------------------------------------------
vi.mock('@/shared/context/OrgContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/context/OrgContext')>();
  return {
    ...actual,
    useOrg: () => ({
      currentOrgId: 'org1',
      setCurrentOrgId: () => {},
      currentOrg: { id: 'org1', name: 'ООО "Тест"', color: '#228be6' },
      organizations: [],
      organizationsLoading: false,
    }),
  };
});

const ORG_NAME = 'ООО "Тест"';
const DATE = '2026-06-01';

/** Неразрывный пробел, который `toLocaleString('ru-RU')` ставит между разрядами. */
const NBSP = '\u00a0';

/**
 * Ожидаемая строка суммы. Собрана вручную, чтобы проверки не зависели от
 * `formatAmountRub` — иначе поломка форматтера прошла бы незамеченной.
 */
function rub(value: number): string {
  const [int, dec] = value.toFixed(2).split('.');
  const grouped = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${grouped},${dec ?? '00'} ₽`;
}

/**
 * Разбирает напечатанную сумму обратно в число — для сверки итогов.
 * Берёт хвост после двоеточия, чтобы понимать и строки ячеек,
 * и строки вида `ОБЩИЙ ИТОГО: 170 000,00 ₽`.
 */
function parseRub(text: string): number {
  const tail = text.includes(':') ? text.slice(text.lastIndexOf(':') + 1) : text;
  return Number(
    tail
      .replace(/\u00a0/g, '')
      .replace(/\s/g, '')
      .replace('₽', '')
      .replace(',', '.'),
  );
}

interface PrintProps {
  invoices: IInvoice[];
  objects: IAccountingObject[];
  date: string;
  visibleColumns: InvoiceColumnId[];
  paymentMarks?: IPaymentMark[];
  canViewPaymentMarks: boolean;
  canViewPaidDate: boolean;
  usersMap: Map<string, IUser>;
  role: OrgRole;
}

const USERS = new Map<string, IUser>([['admin1', adminUser]]);

function invoice(partial: Partial<IInvoice> = {}): IInvoice {
  return {
    id: 'inv-x',
    organization_id: 'org1',
    accounting_object_id: accObj1.id,
    date: DATE,
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

/**
 * Счёт с неустановленным полем `payment_amounts`: в PocketBase это JSON-колонка
 * с `required: false` и без default, поэтому незаполненное поле приходит
 * именно как `undefined`, а не как `[]`.
 */
function invoiceWithoutPaymentAmounts(partial: Partial<IInvoice> = {}): IInvoice {
  return { ...invoice(partial), payment_amounts: undefined as unknown as number[] };
}

function mark(partial: Partial<IPaymentMark> = {}): IPaymentMark {
  return {
    id: 'pm1',
    invoice_id: 'inv-x',
    organization_id: 'org1',
    amount: null,
    comment: '',
    created_by: 'admin1',
    created: '2026-06-02T10:00:00Z',
    ...partial,
  };
}

interface ObjectBlock {
  name: string;
  header: string[];
  rows: string[][];
  total: string;
}

interface PrintSheet {
  org: string;
  date: string;
  blocks: ObjectBlock[];
  grandTotal: string;
}

function text(node: Element | null): string {
  return node?.textContent ?? '';
}

/** Разбирает отрендеренный портал в структуру данных листа. */
function readSheet(): PrintSheet {
  const root = document.querySelector('.print-overlay');
  if (!root) throw new Error('печатный слой не найден в document.body');

  const blocks = Array.from(root.querySelectorAll('.print-obj-header')).map((node) => {
    const container = node.parentElement as HTMLElement;
    const table = container.querySelector('table') as HTMLTableElement;
    return {
      name: text(node),
      header: Array.from(table.querySelectorAll('thead th')).map(text),
      rows: Array.from(table.querySelectorAll('tbody tr')).map((row) =>
        Array.from(row.querySelectorAll('td')).map(text),
      ),
      total: text(container.querySelector('.print-total')),
    };
  });

  return {
    org: text(root.querySelector('.print-org')),
    date: text(root.querySelector('.print-date')),
    blocks,
    grandTotal: text(root.querySelector('.print-grand-total')),
  };
}

function renderSheet(props: Partial<PrintProps> = {}): PrintSheet {
  renderWithProviders(
    <PrintableInvoices
      invoices={[invoice()]}
      objects={[accObj1]}
      date={DATE}
      visibleColumns={['counterparty', 'amount']}
      canViewPaymentMarks={true}
      canViewPaidDate={true}
      usersMap={USERS}
      role="admin"
      {...props}
    />,
  );
  return readSheet();
}

/** Почти все проверки одноблочные — печатается один объект учёта. */
function onlyBlock(sheet: PrintSheet): ObjectBlock {
  expect(sheet.blocks).toHaveLength(1);
  return sheet.blocks[0]!;
}

/**
 * Строка листа, адресованная по подписи шапки. Привязка идёт по позиции, поэтому
 * значение одновременно оказывается в колонке, под которой подписано.
 */
function rowMap(block: ObjectBlock, rowIndex = 0): Record<string, string> {
  const row = block.rows[rowIndex];
  if (!row) throw new Error(`в блоке «${block.name}» нет строки ${rowIndex}`);
  const result: Record<string, string> = {};
  block.header.forEach((label, index) => {
    result[label] = row[index] ?? '';
  });
  return result;
}

function cell(block: ObjectBlock, rowIndex: number, label: string): string {
  return rowMap(block, rowIndex)[label] ?? '';
}

describe('PrintableInvoices', () => {
  describe('шапка листа', () => {
    it('печатает имя организации и дату в формате ДД.ММ.ГГГГ', () => {
      const sheet = renderSheet();

      expect(sheet.org).toBe(ORG_NAME);
      expect(sheet.date).toBe('01.06.2026');
    });
  });

  describe('выбор колонок (printColumns)', () => {
    it('печатает колонки в том же порядке, в котором их запросили', () => {
      const sheet = renderSheet({ visibleColumns: ['amount', 'counterparty'] });

      expect(onlyBlock(sheet).header).toEqual(['№', 'Сумма', 'Контрагент']);
    });

    it('не добавляет колонки, которых не было в настройках', () => {
      // Роль admin разрешает все 13 колонок, но печать идёт по набору пользователя.
      const sheet = renderSheet({ visibleColumns: ['counterparty'], role: 'admin' });

      expect(onlyBlock(sheet).header).toEqual(['№', 'Контрагент']);
    });

    it('вырезает служебные колонки actions и files', () => {
      const sheet = renderSheet({ visibleColumns: ['counterparty', 'actions', 'files', 'amount'] });

      expect(onlyBlock(sheet).header).toEqual(['№', 'Контрагент', 'Сумма']);
    });

    it('вырезает «Отметка», когда права видеть отметки нет', () => {
      const sheet = renderSheet({
        visibleColumns: ['counterparty', 'payment_mark', 'amount'],
        canViewPaymentMarks: false,
      });

      expect(onlyBlock(sheet).header).toEqual(['№', 'Контрагент', 'Сумма']);
    });

    it('вырезает «Дата оплаты», когда права видеть дату оплаты нет', () => {
      const sheet = renderSheet({
        visibleColumns: ['counterparty', 'paid_date', 'amount'],
        canViewPaidDate: false,
      });

      expect(onlyBlock(sheet).header).toEqual(['№', 'Контрагент', 'Сумма']);
    });

    it('guest: «Отметка» вырезается ролью, даже когда право видеть отметки есть', () => {
      const sheet = renderSheet({
        visibleColumns: ['counterparty', 'payment_mark'],
        role: 'guest',
        canViewPaymentMarks: true,
      });

      expect(onlyBlock(sheet).header).toEqual(['№', 'Контрагент']);
    });

    it('boss: «Отметка» остаётся на листе, потому что роль её разрешает', () => {
      const sheet = renderSheet({ visibleColumns: ['payment_mark'], role: 'boss' });

      expect(onlyBlock(sheet).header).toEqual(['№', 'Отметка']);
    });

    it('без роли не печатает ни одной колонки, кроме «№»', () => {
      const sheet = renderSheet({ visibleColumns: ['counterparty', 'amount'], role: null });
      const block = onlyBlock(sheet);

      expect(block.header).toEqual(['№']);
      expect(block.rows).toEqual([['1']]);
    });

    it('вырезает колонку, которой нет у роли, даже если она есть в настройках', () => {
      // Заодно объясняет, почему фолбэк `HEADER_LABELS[colId] ?? colId` — мёртвый код:
      // любой id вне набора роли отсекается фильтром, а все id набора есть в HEADER_LABELS.
      const mystery = 'mystery' as InvoiceColumnId;
      const sheet = renderSheet({
        visibleColumns: ['counterparty', mystery, 'initiator'],
        role: 'guest',
      });

      expect(onlyBlock(sheet).header).toEqual(['№', 'Контрагент', 'Инициатор']);
    });
  });

  describe('привязка счетов к объектам (objBindings)', () => {
    it('печатает блок для каждого объекта со счетами, в порядке массива objects', () => {
      const sheet = renderSheet({
        objects: [accObj2, accObj1],
        invoices: [
          invoice({ accounting_object_id: accObj1.id }),
          invoice({ id: 'inv2', accounting_object_id: accObj2.id }),
        ],
      });

      expect(sheet.blocks.map((block) => block.name)).toEqual([
        'Капитальные вложения',
        'Основная деятельность',
      ]);
    });

    it('не печатает объект, у которого нет счетов', () => {
      const sheet = renderSheet({ objects: [accObj1, accObj2], invoices: [invoice()] });

      expect(sheet.blocks.map((block) => block.name)).toEqual(['Основная деятельность']);
    });

    it('молча теряет счёт, чей объект учёта не передан в objects', () => {
      const sheet = renderSheet({
        objects: [accObj2],
        invoices: [invoice({ amount: 1000 }), invoice({ id: 'inv2', seq: 2, amount: 2000 })],
      });

      expect(sheet.blocks).toEqual([]);
      expect(sheet.grandTotal).toBe(`ОБЩИЙ ИТОГО: ${rub(0)}`);
    });

    it('привязывает счёт к объекту по развёрнутой ссылке, а не по голой строке', () => {
      const sheet = renderSheet({
        invoices: [
          invoice({ accounting_object_id: { id: accObj1.id } as unknown as string, amount: 7000 }),
        ],
      });
      const block = onlyBlock(sheet);

      expect(block.name).toBe('Основная деятельность');
      expect(cell(block, 0, 'Сумма')).toBe(rub(7000));
    });

    it('группирует счета объекта по контрагентам и сортирует группы по первому появлению', () => {
      const sheet = renderSheet({
        visibleColumns: ['counterparty'],
        invoices: [
          invoice({ id: 'b1', counterparty: 'ООО "Б"', created: '2026-06-01T08:00:00Z' }),
          invoice({ id: 'a1', counterparty: 'ООО "А"', created: '2026-06-01T09:00:00Z' }),
          invoice({
            id: 'b2',
            seq: 2,
            counterparty: 'ООО "Б"',
            created: '2026-06-01T10:00:00Z',
          }),
        ],
      });
      const block = onlyBlock(sheet);

      expect(block.rows.map((_, index) => cell(block, index, 'Контрагент'))).toEqual([
        'ООО "Б"',
        'ООО "Б"',
        'ООО "А"',
      ]);
    });

    it('нумерует строки заново в каждом объекте', () => {
      const sheet = renderSheet({
        objects: [accObj1, accObj2],
        invoices: [
          invoice({ id: 'i1', amount: 100 }),
          invoice({ id: 'i2', seq: 2, amount: 200 }),
          invoice({
            id: 'i3',
            accounting_object_id: accObj2.id,
            counterparty: 'ООО "Б"',
            amount: 300,
          }),
        ],
      });
      const [first, second] = sheet.blocks;

      expect(first?.rows.map((row) => row[0])).toEqual(['1', '2']);
      expect(second?.rows.map((row) => row[0])).toEqual(['1']);
    });
  });

  describe('частичные оплаты: копии платежей и строка остатка', () => {
    it('разворачивает несколько платежей в копии и добавляет строку остатка', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount', 'paid'],
        invoices: [invoice({ amount: 50000, payment_amounts: [20000, 15000] })],
      });
      const block = onlyBlock(sheet);

      expect(block.rows).toEqual([
        ['1', rub(50000), 'Нет'],
        ['', '', rub(15000)],
        ['', `Остаток: ${rub(15000)}`, 'Нет'],
      ]);
    });

    it('в копиях и остатке повторяет назначение платежа, остальные колонки оставляет пустыми', () => {
      const sheet = renderSheet({
        visibleColumns: ['counterparty', 'purpose', 'amount', 'paid'],
        invoices: [
          invoice({ purpose: 'Аренда помещения', amount: 50000, payment_amounts: [20000, 15000] }),
        ],
      });
      const block = onlyBlock(sheet);

      expect(cell(block, 1, 'Назначение платежа')).toBe('Аренда помещения');
      expect(cell(block, 1, 'Контрагент')).toBe('');
      expect(cell(block, 1, 'Сумма')).toBe('');
      expect(cell(block, 2, 'Назначение платежа')).toBe('Аренда помещения');
    });

    it('не добавляет ни копий, ни остатка при одной оплате, покрывающей счёт', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount', 'paid'],
        invoices: [invoice({ paid: true, amount: 50000, payment_amounts: [50000] })],
      });
      const block = onlyBlock(sheet);

      expect(block.rows).toEqual([['1', rub(50000), rub(50000)]]);
      expect(block.total).toBe(`Итого по «Основная деятельность»: ${rub(0)}`);
    });

    it('не добавляет строку остатка, когда платёж перекрывает сумму счёта', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount', 'paid'],
        invoices: [invoice({ amount: 50000, payment_amounts: [60000] })],
      });

      expect(onlyBlock(sheet).rows).toEqual([['1', rub(50000), 'Нет']]);
    });

    it('не нумерует копии и остаток: номера продолжаются только по основным счетам', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount'],
        invoices: [
          invoice({ id: 'i1', amount: 50000, payment_amounts: [20000, 15000] }),
          invoice({ id: 'i2', seq: 2, counterparty: 'ООО "Гвоздь"', amount: 7000 }),
        ],
      });
      const block = onlyBlock(sheet);

      expect(block.rows.map((row) => row[0])).toEqual(['1', '', '', '2']);
    });
  });

  describe('отметки к оплате (marksByInvoice)', () => {
    it('без отметки в «Отметка» пишет прочерк', () => {
      const sheet = renderSheet({ visibleColumns: ['payment_mark'] });

      expect(cell(onlyBlock(sheet), 0, 'Отметка')).toBe('—');
    });

    it('в «Отметка» собирает статус, сумму и комментарий', () => {
      const sheet = renderSheet({
        visibleColumns: ['payment_mark'],
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [mark({ status: 'partial', amount: 12000, comment: 'по договору' })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Отметка')).toBe(`Частично: ${rub(12000)} (по договору)`);
    });

    it('в «Отметка» без комментария не оставляет пустых скобок', () => {
      const sheet = renderSheet({
        visibleColumns: ['payment_mark'],
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [mark({ status: 'partial', amount: 12000 })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Отметка')).toBe(`Частично: ${rub(12000)}`);
    });

    it('в «Отметка» у отметки без суммы пишет сумму счёта', () => {
      const sheet = renderSheet({
        visibleColumns: ['payment_mark'],
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [mark({ status: 'proposed', amount: null })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Отметка')).toBe(`Согласование: ${rub(50000)}`);
    });

    it('в «Отметка» различает полную оплату, частичную и отсутствие отметки', () => {
      const sheet = renderSheet({
        visibleColumns: ['payment_mark'],
        invoices: [
          invoice({ id: 'i1', amount: 50000 }),
          invoice({ id: 'i2', seq: 2, amount: 50000 }),
          invoice({ id: 'i3', seq: 3, amount: 50000 }),
        ],
        paymentMarks: [
          mark({ id: 'pm-full', invoice_id: 'i1', status: 'approved', amount: 50000 }),
          mark({ id: 'pm-legacy', invoice_id: 'i2', amount: 30000 }),
        ],
      });
      const block = onlyBlock(sheet);

      expect(block.rows.map((_, index) => cell(block, index, 'Отметка'))).toEqual([
        `Оплатить: ${rub(50000)}`,
        `Частично: ${rub(30000)}`,
        '—',
      ]);
    });

    it('в «Отметка» берёт последнюю из нескольких отметок одного счёта', () => {
      const sheet = renderSheet({
        visibleColumns: ['payment_mark'],
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [
          mark({ id: 'pm-old', status: 'partial', amount: 10000 }),
          mark({ id: 'pm-new', status: 'approved', amount: 50000 }),
        ],
      });

      expect(cell(onlyBlock(sheet), 0, 'Отметка')).toBe(`Оплатить: ${rub(50000)}`);
    });

    it('отметка чужого счёта не попадает в «Отметка»', () => {
      const sheet = renderSheet({
        visibleColumns: ['payment_mark'],
        invoices: [invoice({ amount: 50000 })],
        paymentMarks: [mark({ invoice_id: 'inv-other', status: 'approved', amount: 50000 })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Отметка')).toBe('—');
    });

    it('отметка одного счёта не показывается в строке другого', () => {
      const sheet = renderSheet({
        visibleColumns: ['payment_mark'],
        invoices: [
          invoice({ id: 'i1', amount: 50000 }),
          invoice({ id: 'i2', seq: 2, counterparty: 'ООО "Гвоздь"', amount: 50000 }),
        ],
        paymentMarks: [mark({ invoice_id: 'i1', status: 'approved', amount: 50000 })],
      });
      const block = onlyBlock(sheet);

      expect(block.rows.map((_, index) => cell(block, index, 'Отметка'))).toEqual([
        `Оплатить: ${rub(50000)}`,
        '—',
      ]);
    });

    it('без переданных отметок в «Отметка» пишет прочерк', () => {
      const sheet = renderSheet({ visibleColumns: ['payment_mark'], paymentMarks: undefined });

      expect(cell(onlyBlock(sheet), 0, 'Отметка')).toBe('—');
    });
  });

  describe('текст ячеек (cellText)', () => {
    it('переносит контрагента, назначение и номер счёта дословно, без прочерка', () => {
      const sheet = renderSheet({
        visibleColumns: ['counterparty', 'purpose', 'invoice_no'],
        invoices: [invoice({ purpose: '', invoice_no: 'СФ-9' })],
      });

      expect(rowMap(onlyBlock(sheet))).toEqual({
        '№': '1',
        Контрагент: 'ООО "Ромашка"',
        // Пустое назначение платежа остаётся пустой ячейкой, а не «—».
        'Назначение платежа': '',
        Счёт: 'СФ-9',
      });
    });

    it('подставляет прочерк вместо пустых договора, даты оплаты и комментария', () => {
      const sheet = renderSheet({
        visibleColumns: ['contract_no', 'paid_date', 'comment'],
        invoices: [invoice({ contract_no: '', paid_date: '', comment: '' })],
      });

      expect(rowMap(onlyBlock(sheet))).toEqual({
        '№': '1',
        Договор: '—',
        'Дата оплаты': '—',
        Комментарий: '—',
      });
    });

    it('переносит заполненные договор, дату оплаты и комментарий, дату — в формате ДД.ММ.ГГГГ', () => {
      const sheet = renderSheet({
        visibleColumns: ['contract_no', 'paid_date', 'comment'],
        invoices: [
          invoice({ paid: true, paid_date: '2026-06-02', contract_no: 'Д-77', comment: 'срочно' }),
        ],
      });

      expect(rowMap(onlyBlock(sheet))).toEqual({
        '№': '1',
        Договор: 'Д-77',
        'Дата оплаты': '02.06.2026',
        Комментарий: 'срочно',
      });
    });

    it('в «Сумма» у неоплаченного счёта пишет базовую сумму, несмотря на частичные платежи', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount'],
        invoices: [invoice({ amount: 50000, payment_amounts: [20000] })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Сумма')).toBe(rub(50000));
    });

    it('в «Сумма» у оплаченного счёта пишет сумму платежей', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount'],
        invoices: [invoice({ paid: true, amount: 50000, payment_amounts: [41000, 9000] })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Сумма')).toBe(rub(50000));
    });

    it('в «Сумма» у оплаченного счёта с пустым списком платежей пишет сумму счёта', () => {
      // `getEffectiveAmount` проверяет `.length`, поэтому пустой массив не мешает.
      const sheet = renderSheet({
        visibleColumns: ['amount'],
        invoices: [invoice({ paid: true, amount: 40000, payment_amounts: [] })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Сумма')).toBe(rub(40000));
    });

    it('у неоплаченного счёта в «Оплачено» пишет «Нет»', () => {
      const sheet = renderSheet({
        visibleColumns: ['paid'],
        invoices: [invoice({ amount: 50000, payment_amounts: [20000] })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Оплачено')).toBe('Нет');
    });

    it('у оплаченного счёта «Оплачено» равно сумме платежей, а не сумме счёта', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount', 'paid'],
        invoices: [invoice({ paid: true, amount: 100000, payment_amounts: [60000] })],
      });
      const block = onlyBlock(sheet);

      // Сумма счёта 100 000 ₽ — её в «Оплачено» быть не должно ни при каких условиях.
      expect(cell(block, 0, 'Оплачено')).toBe(rub(60000));
      expect(cell(block, 0, 'Оплачено')).not.toBe(rub(100000));
      expect(cell(block, 0, 'Сумма')).toBe(rub(60000));
    });

    it('суммирует несколько платежей оплаченного счёта в «Оплачено»', () => {
      // Сумма счёта заведомо больше суммы платежей, иначе проверка не отличает
      // сумму платежей от суммы счёта.
      const sheet = renderSheet({
        visibleColumns: ['paid'],
        invoices: [invoice({ paid: true, amount: 130000, payment_amounts: [40000, 35000, 25000] })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Оплачено')).toBe(rub(100000));
    });

    it('у оплаченного счёта с неустановленным payment_amounts в «Оплачено» пишет сумму счёта', () => {
      // `??` срабатывает штатно: незаполненная JSON-колонка приходит как undefined.
      const sheet = renderSheet({
        visibleColumns: ['paid'],
        invoices: [invoiceWithoutPaymentAmounts({ paid: true, amount: 40000, paid_amount: 40000 })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Оплачено')).toBe(rub(40000));
    });

    it('у оплаченного счёта с пустым payment_amounts в «Оплачено» печатает «0,00 ₽» — латентный дефект', () => {
      // НЕ спецификация, а зафиксированное поведение.
      // Строка 127: `invoice.payment_amounts?.reduce((s, a) => s + a, 0) ?? invoice.amount`.
      // Пустой массив сворачивается в 0, а `??` на 0 не срабатывает, поэтому
      // запасной вариант не включается и на листе появляется «0,00 ₽».
      // Колонка «Сумма» той же строки печатает сумму счёта (getEffectiveAmount
      // проверяет `.length`), то есть одна строка листа противоречит сама себе.
      // Сейчас это недостижимо: в БД `payment_amounts` — JSON-колонка required:false
      // без default, поле приходит как undefined. Пустой массив встречается только в
      // синтетическом объекте GroupedInvoiceTable.tsx:1028, который не сохраняется.
      // Тот же идиом — GroupedInvoiceTable.tsx:543 и exportInvoicesToExcel.ts:87.
      const sheet = renderSheet({
        visibleColumns: ['amount', 'paid'],
        invoices: [invoice({ paid: true, paid_amount: 40000, amount: 40000, payment_amounts: [] })],
      });
      const block = onlyBlock(sheet);

      expect(cell(block, 0, 'Оплачено')).toBe('0,00 ₽');
      expect(cell(block, 0, 'Сумма')).toBe(rub(40000));
    });

    it('в «Инициатор» отдаёт приоритет снимку имени над справочником пользователей', () => {
      const sheet = renderSheet({
        visibleColumns: ['initiator'],
        invoices: [invoice({ created_by: 'admin1', created_by_name: 'Снимок имени' })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Инициатор')).toBe('Снимок имени');
    });

    it('в «Инициатор» без снимка имени берёт пользователя из справочника', () => {
      const sheet = renderSheet({
        visibleColumns: ['initiator'],
        invoices: [invoice({ created_by: 'admin1', created_by_name: '' })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Инициатор')).toBe('Админ');
    });

    it('в «Инициатор» для неизвестного пользователя пишет прочерк', () => {
      const sheet = renderSheet({
        visibleColumns: ['initiator'],
        invoices: [invoice({ created_by: 'ghost', created_by_name: '' })],
      });

      expect(cell(onlyBlock(sheet), 0, 'Инициатор')).toBe('—');
    });
  });

  describe('итоги: по объекту и общий', () => {
    it('считает итог по объекту только из неоплаченных счетов', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount'],
        invoices: [
          invoice({ id: 'i1', amount: 50000 }),
          invoice({ id: 'i2', seq: 2, amount: 30000, paid: true, payment_amounts: [30000] }),
        ],
      });

      expect(onlyBlock(sheet).total).toBe(`Итого по «Основная деятельность»: ${rub(50000)}`);
    });

    it('складывает итоги разных объектов в общий итог', () => {
      const sheet = renderSheet({
        objects: [accObj1, accObj2],
        visibleColumns: ['amount'],
        invoices: [
          invoice({ id: 'i1', amount: 50000 }),
          invoice({
            id: 'i2',
            seq: 2,
            amount: 30000,
            paid: true,
            payment_amounts: [30000],
          }),
          invoice({
            id: 'i3',
            seq: 3,
            amount: 120000,
            accounting_object_id: accObj2.id,
            counterparty: 'ООО "Поставщик Б"',
          }),
        ],
      });

      expect(sheet.blocks.map((block) => block.total)).toEqual([
        `Итого по «Основная деятельность»: ${rub(50000)}`,
        `Итого по «Капитальные вложения»: ${rub(120000)}`,
      ]);
      expect(sheet.grandTotal).toBe(`ОБЩИЙ ИТОГО: 170${NBSP}000,00 ₽`);
    });

    it('общий итог сходится с суммой неоплаченных строк, напечатанных над ним', () => {
      const sheet = renderSheet({
        objects: [accObj1, accObj2],
        visibleColumns: ['invoice_no', 'amount', 'paid'],
        invoices: [
          invoice({ id: 'i1', invoice_no: 'СФ-001', amount: 50000 }),
          invoice({
            id: 'i2',
            seq: 2,
            invoice_no: 'СФ-002',
            amount: 30000,
            paid: true,
            payment_amounts: [30000],
          }),
          invoice({
            id: 'i3',
            seq: 3,
            invoice_no: 'СФ-003',
            amount: 120000,
            accounting_object_id: accObj2.id,
            counterparty: 'ООО "Поставщик Б"',
          }),
        ],
      });

      const printed = sheet.blocks.flatMap((block) =>
        block.rows.map((_, index) => rowMap(block, index)),
      );
      const unpaid = printed.filter((row) => row['Оплачено'] === 'Нет');

      // Итог на листе обязан сходиться со строками, которые видит бухгалтер.
      expect(unpaid.map((row) => row['Счёт'])).toEqual(['СФ-001', 'СФ-003']);
      expect(parseRub(sheet.grandTotal)).toBe(
        unpaid.reduce((sum, row) => sum + parseRub(row['Сумма'] ?? '0'), 0),
      );
    });

    it('даёт нулевой итог по объекту и общий итог, когда все счета оплачены', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount', 'paid'],
        invoices: [invoice({ paid: true, amount: 50000, payment_amounts: [50000] })],
      });

      expect(onlyBlock(sheet).total).toBe(`Итого по «Основная деятельность»: ${rub(0)}`);
      expect(sheet.grandTotal).toBe(`ОБЩИЙ ИТОГО: ${rub(0)}`);
    });

    it('частично оплаченный неоплаченный счёт даёт в итог полную сумму, а не остаток — фактическое поведение', () => {
      // Фактическое поведение: строка остатка ниже показывает 30 000 ₽,
      // а в итог идёт 50 000 ₽ — так же, как «ИТОГО» на экране реестра.
      const sheet = renderSheet({
        visibleColumns: ['amount', 'paid'],
        invoices: [invoice({ amount: 50000, payment_amounts: [20000] })],
      });
      const block = onlyBlock(sheet);

      expect(cell(block, 1, 'Сумма')).toBe(`Остаток: ${rub(30000)}`);
      expect(block.total).toBe(`Итого по «Основная деятельность»: ${rub(50000)}`);
    });

    it('округляет копейки при суммировании и не выдаёт хвост float', () => {
      const sheet = renderSheet({
        visibleColumns: ['amount'],
        invoices: [invoice({ id: 'i1', amount: 0.1 }), invoice({ id: 'i2', seq: 2, amount: 0.2 })],
      });

      expect(sheet.grandTotal).toBe(`ОБЩИЙ ИТОГО: ${rub(0.3)}`);
      expect(sheet.grandTotal).not.toContain('0,3000');
    });
  });

  describe('пустые входные данные', () => {
    it('без счетов печатает только шапку и нулевой общий итог', () => {
      const sheet = renderSheet({ invoices: [] });

      expect(sheet.org).toBe(ORG_NAME);
      expect(sheet.blocks).toEqual([]);
      expect(sheet.grandTotal).toBe(`ОБЩИЙ ИТОГО: ${rub(0)}`);
    });

    it('без объектов не печатает ни одного счёта и даёт нулевой итог', () => {
      const sheet = renderSheet({ objects: [] });

      expect(sheet.blocks).toEqual([]);
      expect(sheet.grandTotal).toBe(`ОБЩИЙ ИТОГО: ${rub(0)}`);
    });

    it('без выбранных колонок оставляет на листе только номера строк', () => {
      const sheet = renderSheet({ visibleColumns: [] });
      const block = onlyBlock(sheet);

      expect(block.header).toEqual(['№']);
      expect(block.rows).toEqual([['1']]);
      expect(block.total).toBe(`Итого по «Основная деятельность»: ${rub(1000)}`);
      expect(sheet.grandTotal).toBe(`ОБЩИЙ ИТОГО: ${rub(1000)}`);
    });
  });
});
