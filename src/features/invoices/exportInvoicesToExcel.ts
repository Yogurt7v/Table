/**
 * Экспорт счетов в Excel (.xlsx).
 *
 * Все объекты учёта — на одном листе, друг за другом:
 *   строка 1: название организации
 *   строка 2: дата
 *   строка 3: пустая
 *   Для каждого объекта:
 *     строка: название объекта (жирным)
 *     строка: заголовки колонок (№ + выбранные пользователем)
 *     строки: счета, сгруппированные по контрагенту
 *     пустая строка
 *   Итоговая строка: общий итог по всем объектам
 *
 * Частичные оплаты разворачиваются в дополнительные строки:
 *   - копии платежей (строки без №, колонка «Оплачено»)
 *   - строка остатка (колонка «Сумма» = "Остаток: ...")
 */

import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { groupInvoicesByCounterparty } from '@/shared/utils/group-invoices';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { getInvoicePaymentInfo } from '@/features/invoices/utils/expand-invoice-rows';
import type { IInvoice, IAccountingObject, IPaymentMark, InvoiceColumnId, IUser } from '@/shared/types';

// ---------------------------------------------------------------------------
// Соответствие InvoiceColumnId → заголовок столбца в Excel.
// Эти заголовки попадают в шапку таблицы каждого объекта.
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
  initiator: 'Инициатор',
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
  userMap: Map<string, IUser>,
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

    case 'initiator':
      return userMap.get(invoice.created_by)?.name ?? '—';

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
  usersMap: Map<string, IUser>;
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
    usersMap,
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
  //    Порядок объектов = порядок в исходном массиве objects (как на странице).
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

  // Общий итог по всем объектам (последняя строка листа).
  const grandTotal = objBindings.reduce((sum, b) => sum + b.unpaidTotal, 0);

  // Создаём новую книгу Excel.
  const wb = XLSX.utils.book_new();

  // Шапка таблицы — одинакова для всех объектов.
  const headerRow = ['№', ...cols.map((c) => HEADER_LABELS[c] ?? c)];

  // -----------------------------------------------------------------------
  // 4. Собираем все данные на один лист.
  // -----------------------------------------------------------------------
  const data: unknown[][] = [];

  // --- Верхние строки (орг, дата) ---
  data.push([orgName]);
  data.push([dayjs(date).format('DD.MM.YYYY')]);
  data.push([]);

  // --- Для каждого объекта: заголовок + таблица ---
  for (const { obj, groups } of objBindings) {
    // Строка с названием объекта
    data.push([obj.name]);

    // Шапка таблицы
    data.push(headerRow);

    // Строки счетов
    let rowNum = 0;
    for (const group of groups) {
      for (const invoice of group.invoices) {
        const { amounts, remaining, hasCopies, hasRemainder } = getInvoicePaymentInfo(invoice);

        // ---- Основная строка счёта ----
        rowNum++;
        const row: unknown[] = [rowNum];
        for (const colId of cols) {
          row.push(cellText(colId, invoice, marksByInvoice, usersMap));
        }
        data.push(row);

        // ---- Копии для частичных оплат (payment_amounts[1..n]) ----
        if (hasCopies) {
          for (let i = 1; i < amounts.length; i++) {
            const copyAmt = amounts[i]!;
            const copyRow: unknown[] = [''];
            for (const colId of cols) {
              if (colId === 'paid') {
                copyRow.push(formatAmountRub(copyAmt));
              } else if (colId === 'purpose') {
                copyRow.push(invoice.purpose);
              } else {
                copyRow.push('');
              }
            }
            data.push(copyRow);
          }
        }

        // ---- Строка остатка (если оплачено частично) ----
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

    // Пустая строка между объектами
    data.push([]);
  }

  // --- Итоговая строка ---
  data.push([`Итого по всем объектам: ${formatAmountRub(grandTotal)}`]);

  // -----------------------------------------------------------------------
  // 5. Создаём один лист и настраиваем ширину колонок.
  // -----------------------------------------------------------------------
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 5 }, ...cols.map(() => ({ wch: 24 }))];
  XLSX.utils.book_append_sheet(wb, ws, 'Счета');

  // -----------------------------------------------------------------------
  // 6. Сохранение файла.
  // -----------------------------------------------------------------------
  const suffix = isSingleObject ? `_${objects[0]!.name.replace(/[/\\?*[\]:]/g, '_')}` : '';
  const fileName = `Счета${suffix}_${dayjs(date).format('YYYY-MM-DD')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
