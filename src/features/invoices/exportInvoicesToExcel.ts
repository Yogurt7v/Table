/**
 * Экспорт счетов в Excel (.xlsx).
 *
 * Формат таблицы на листе (каждый объект учёта — отдельный лист):
 *   строка 1: название организации
 *   строка 2: дата
 *   строка 3: название объекта учёта
 *   строка 4: пустая
 *   строка 5: заголовки колонок (№ + выбранные пользователем)
 *   строка 6+: строки счетов, сгруппированные по контрагенту
 *   последние строки: итого по объекту
 *
 * Частичные оплаты разворачиваются в дополнительные строки:
 *   - копии платежей (строки без №, колонка «Оплачено»)
 *   - строка остатка (колонка «Сумма» = "Остаток: ...")
 *
 * Последний лист — сводка «Итого» с суммами по всем объектам.
 */

import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { groupInvoicesByCounterparty } from '@/shared/utils/group-invoices';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { getInvoicePaymentInfo } from '@/features/invoices/utils/expand-invoice-rows';
import type { IInvoice, IAccountingObject, IPaymentMark, InvoiceColumnId } from '@/shared/types';

// ---------------------------------------------------------------------------
// Соответствие InvoiceColumnId → заголовок столбца в Excel.
// Эти заголовки попадают в шапку таблицы на каждом листе.
// Если нужно переименовать колонку или добавить новую — менять здесь.
// ---------------------------------------------------------------------------
const HEADER_LABELS: Partial<Record<InvoiceColumnId, string>> = {
  counterparty: 'Контрагент',
  purpose: 'Назначение платежа',
  contract_no: 'Договор',
  invoice_no: 'Счёт',
  amount: 'Сумма',
  paid: 'Оплачено',
  paid_date: 'Дата оплаты',
  comment: 'Комментарий',
  payment_mark: 'Отметка',
};

// ---------------------------------------------------------------------------
// Преобразует значение поля счёта в строку для ячейки Excel.
// Форматирование: рубли с копейками, прочерк для пустых полей.
// Для колонки paid — сумма оплаты или "Нет".
// payment_mark — расшифровка отметки об оплате.
// ---------------------------------------------------------------------------
function cellText(
  colId: InvoiceColumnId,
  invoice: IInvoice,
  marksByInvoice: Record<string, IPaymentMark>,
): string {
  switch (colId) {
    case 'counterparty':
      return invoice.counterparty;

    case 'purpose':
      return invoice.purpose;

    case 'contract_no':
      return invoice.contract_no || '—';

    case 'invoice_no':
      return invoice.invoice_no;

    case 'amount':
      return formatAmountRub(invoice.amount);

    case 'paid': {
      // Если оплачен — показываем общую сумму проведённых платежей.
      if (invoice.paid) {
        return formatAmountRub(
          invoice.payment_amounts?.reduce((s, a) => s + a, 0) ?? invoice.amount,
        );
      }
      return 'Нет';
    }

    case 'paid_date':
      return invoice.paid_date || '—';

    case 'comment':
      return invoice.comment || '—';

    case 'payment_mark': {
      // Отметка к оплате: сумма + комментарий.
      const mark = marksByInvoice[invoice.id];
      if (!mark) return '—';
      if (mark.amount == null) return `К оплате: ${formatAmountRub(invoice.amount)}`;
      const parts = [`К оплате: ${formatAmountRub(mark.amount)}`];
      if (mark.comment) parts.push(`(${mark.comment})`);
      return parts.join(' ');
    }

    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Параметры экспорта.
//   invoices, objects — уже отфильтрованные (например, с учётом hidePaid).
//   Если в objects только один объект, в имя файла добавляется его название.
// ---------------------------------------------------------------------------
export interface ExportInvoicesParams {
  invoices: IInvoice[];
  objects: IAccountingObject[];
  date: string;
  visibleColumns: InvoiceColumnId[];
  paymentMarks?: IPaymentMark[];
  canViewPaymentMarks: boolean;
  canViewPaidDate: boolean;
  orgName: string;
}

export function exportInvoicesToExcel(params: ExportInvoicesParams): void {
  const {
    invoices,
    objects,
    date,
    visibleColumns,
    paymentMarks,
    canViewPaymentMarks,
    canViewPaidDate,
    orgName,
  } = params;

  const isSingleObject = objects.length === 1;

  // -----------------------------------------------------------------------
  // 1. Фильтрация колонок.
  //    Действия, файлы — не попадают в Excel.
  //    payment_mark, paid_date — только если есть права на просмотр.
  // -----------------------------------------------------------------------
  const cols = visibleColumns.filter((colId) => {
    if (colId === 'actions' || colId === 'files') return false;
    if (colId === 'payment_mark' && !canViewPaymentMarks) return false;
    if (colId === 'paid_date' && !canViewPaidDate) return false;
    return true;
  });

  // -----------------------------------------------------------------------
  // 2. Индекс отметок об оплате по invoice_id для быстрого доступа.
  // -----------------------------------------------------------------------
  const marksByInvoice: Record<string, IPaymentMark> = {};
  if (paymentMarks) {
    for (const mark of paymentMarks) {
      marksByInvoice[mark.invoice_id] = mark;
    }
  }

  // -----------------------------------------------------------------------
  // 3. Группировка счетов по объектам учёта.
  //    Для каждого объекта:
  //      - отфильтровываем его счета
  //      - группируем по контрагентам (через groupInvoicesByCounterparty)
  //      - подсчитываем незакрытую сумму (unpaidTotal) — она идёт в итог
  //    Объекты без счетов отбрасываем.
  // -----------------------------------------------------------------------
  const objBindings = objects
    .map((obj) => {
      const objInvoices =
        invoices?.filter((i) => normalizeRelationId(i.accounting_object_id) === obj.id) ?? [];
      const groups = groupInvoicesByCounterparty(objInvoices);
      const unpaidTotal = objInvoices.reduce((sum, inv) => {
        if (!inv.paid) return sum + inv.amount;
        const { amounts, remaining } = getInvoicePaymentInfo(inv);
        if (amounts.length === 0) return sum;
        return remaining > 0 ? sum + remaining : sum;
      }, 0);
      return { obj, groups, unpaidTotal };
    })
    .filter((b) => b.groups.length > 0);

  // Общий итог по всем объектам (для сводного листа).
  const grandTotal = objBindings.reduce((sum, b) => sum + b.unpaidTotal, 0);

  // Создаём новую книгу Excel.
  const wb = XLSX.utils.book_new();

  // Шапка таблицы — одинакова для всех объектов.
  const headerRow = ['№', ...cols.map((c) => HEADER_LABELS[c] ?? c)];

  // -----------------------------------------------------------------------
  // 4. Для каждого объекта формируем лист.
  // -----------------------------------------------------------------------
  for (const { obj, groups, unpaidTotal } of objBindings) {
    // data — массив строк (массивов ячеек), каждая строка — кортеж колонок.
    // Это формат XLSX.utils.aoa_to_sheet (Array of Arrays).
    const data: unknown[][] = [];

    // --- Верхние строки листа (орг, дата, название объекта) ---
    data.push([orgName]);
    data.push([dayjs(date).format('DD.MM.YYYY')]);
    data.push([obj.name]);
    data.push([]);

    // --- Шапка таблицы ---
    data.push(headerRow);

    // --- Строки счетов ---
    let rowNum = 0;
    for (const group of groups) {
      for (const invoice of group.invoices) {
        const { amounts, remaining, hasCopies, hasRemainder } = getInvoicePaymentInfo(invoice);

        // ---- Основная строка счёта ----
        rowNum++;
        const row: unknown[] = [rowNum];
        for (const colId of cols) {
          row.push(cellText(colId, invoice, marksByInvoice));
        }
        data.push(row);

        // ---- Копии для частичных оплат (payment_amounts[1..n]) ----
        // Каждая копия — отдельная строка без номера, только колонка
        // «Оплачено» заполняется суммой этого платежа.
        // Если копий нет (amounts.length <= 1) — пропускаем.
        if (hasCopies) {
          for (let i = 1; i < amounts.length; i++) {
            const copyAmt = amounts[i]!;
            const copyRow: unknown[] = [''];
            for (const colId of cols) {
              if (colId === 'paid') {
                copyRow.push(formatAmountRub(copyAmt));
              } else if (colId === 'purpose') {
                // Дублируем назначение, чтобы было понятно, к какому счету относится.
                copyRow.push(invoice.purpose);
              } else {
                copyRow.push('');
              }
            }
            data.push(copyRow);
          }
        }

        // ---- Строка остатка (если оплачено частично) ----
        // Показываем, сколько ещё осталось доплатить.
        if (hasRemainder) {
          const remainderRow: unknown[] = [''];
          for (const colId of cols) {
            if (colId === 'amount') {
              remainderRow.push(`Остаток: ${formatAmountRub(remaining)}`);
            } else if (colId === 'paid') {
              remainderRow.push('Нет');
            } else if (colId === 'purpose') {
              remainderRow.push(invoice.purpose);
            } else {
              remainderRow.push('');
            }
          }
          data.push(remainderRow);
        }
      }
    }

    // --- Пустая строка перед итогом ---
    data.push([]);

    // --- Итоговая строка по объекту ---
    const totalRow: unknown[] = [];
    totalRow.push(`Итого по «${obj.name}»: ${formatAmountRub(unpaidTotal)}`);
    data.push(totalRow);

    // ---------------------------------------------------------------------
    // Преобразуем массив строк в лист Excel и настраиваем ширину колонок.
    // ws['!cols'] — массив объектов { wch: N }, где N — ширина в символах.
    // Первая колонка (№) — 5 символов, остальные — по 24.
    // ---------------------------------------------------------------------
    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [{ wch: 5 }, ...cols.map(() => ({ wch: 24 }))];

    // Имя листа: название объекта (не длиннее 31 символа — ограничение Excel).
    const sheetName = obj.name.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // -----------------------------------------------------------------------
  // 5. Лист сводки «Итого».
  //    Содержит суммы по каждому объекту и общий итог.
  // -----------------------------------------------------------------------
  const summaryData: unknown[][] = [];
  summaryData.push([orgName]);
  summaryData.push([dayjs(date).format('DD.MM.YYYY')]);
  summaryData.push([]);
  summaryData.push(['Объект', 'Итого']);
  for (const { obj, unpaidTotal } of objBindings) {
    summaryData.push([obj.name, formatAmountRub(unpaidTotal)]);
  }
  summaryData.push([]);
  summaryData.push(['ОБЩИЙ ИТОГО', formatAmountRub(grandTotal)]);

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Итого');

  // -----------------------------------------------------------------------
  // 6. Сохранение файла.
  //    Имя: Счета[_НазваниеОбъекта]_YYYY-MM-DD.xlsx
  //    Если объектов несколько, название объекта не добавляется.
  // -----------------------------------------------------------------------
  const suffix = isSingleObject ? `_${objects[0]!.name.replace(/[/\\?*[\]:]/g, '_')}` : '';
  const fileName = `Счета${suffix}_${dayjs(date).format('YYYY-MM-DD')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
