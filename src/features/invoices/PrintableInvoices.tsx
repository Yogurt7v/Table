import { useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useOrg } from '@/shared/context/OrgContext';
import { groupInvoicesByCounterparty } from '@/shared/utils/group-invoices';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import type { IInvoice, IAccountingObject, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import dayjs from 'dayjs';

interface PrintableInvoicesProps {
  invoices: IInvoice[];
  objects: IAccountingObject[];
  date: string;
  visibleColumns: InvoiceColumnId[];
  paymentMarks?: IPaymentMark[];
  canViewPaymentMarks: boolean;
  canViewPaidDate: boolean;
}

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

export function PrintableInvoices({
  invoices,
  objects,
  date,
  visibleColumns,
  paymentMarks,
  canViewPaymentMarks,
  canViewPaidDate,
}: PrintableInvoicesProps) {
  const { currentOrg } = useOrg();

  const marksByInvoice = useMemo(() => {
    const map: Record<string, IPaymentMark> = {};
    if (paymentMarks) {
      for (const mark of paymentMarks) {
        map[mark.invoice_id] = mark;
      }
    }
    return map;
  }, [paymentMarks]);

  const printColumns = useMemo(
    () =>
      visibleColumns.filter((colId) => {
        if (colId === 'actions' || colId === 'files') return false;
        if (colId === 'payment_mark' && !canViewPaymentMarks) return false;
        if (colId === 'paid_date' && !canViewPaidDate) return false;
        return true;
      }),
    [visibleColumns, canViewPaymentMarks, canViewPaidDate],
  );

  const objBindings = useMemo(() => {
    return objects
      .map((obj) => {
        const objInvoices =
          invoices?.filter((i) => normalizeRelationId(i.accounting_object_id) === obj.id) ?? [];
        const groups = groupInvoicesByCounterparty(objInvoices);
        const unpaidTotal = objInvoices.reduce((sum, inv) => (!inv.paid ? sum + inv.amount : sum), 0);
        return { obj, groups, unpaidTotal };
      })
      .filter((b) => b.groups.length > 0);
  }, [invoices, objects]);

  const grandTotal = useMemo(
    () => objBindings.reduce((sum, b) => sum + b.unpaidTotal, 0),
    [objBindings],
  );

  const renderPaymentMarkText = (invoice: IInvoice): string => {
    const mark = marksByInvoice[invoice.id];
    if (!mark) return '—';
    if (mark.amount == null) return `К оплате: ${formatAmountRub(invoice.amount)}`;
    const parts = [`К оплате: ${formatAmountRub(mark.amount)}`];
    if (mark.comment) parts.push(`(${mark.comment})`);
    return parts.join(' ');
  };

  const cellText = (colId: InvoiceColumnId, invoice: IInvoice): string => {
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
        if (invoice.paid) {
          return formatAmountRub(invoice.paid_amount ?? invoice.amount);
        }
        return 'Нет';
      }
      case 'paid_date':
        return invoice.paid_date || '—';
      case 'comment':
        return invoice.comment || '—';
      case 'payment_mark':
        return renderPaymentMarkText(invoice);
      default:
        return '';
    }
  };

  return createPortal(
    <div className="print-root">
      <style>{`
        @media print {
          @page { margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          html, body { height: auto; overflow: visible; }
          body > *:not(.print-root) { display: none !important; }
          .print-root { display: block !important; }
        }
        .print-root { all: initial; }
        .print-root .print-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #fff;
          overflow: auto;
          padding: 10mm 8mm;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 10pt;
          line-height: 1.4;
          color: #000;
        }
        .print-root .print-overlay h1 {
          font-size: 16pt;
          font-weight: 700;
          margin: 0 0 4pt 0;
          text-align: center;
        }
        .print-root .print-overlay .print-org {
          text-align: center;
          font-size: 11pt;
          margin: 0 0 2pt 0;
        }
        .print-root .print-overlay .print-date {
          text-align: center;
          font-size: 10pt;
          color: #555;
          margin: 0 0 16pt 0;
        }
        .print-root .print-overlay .print-obj-header {
          font-size: 12pt;
          font-weight: 600;
          margin: 20pt 0 8pt 0;
          padding-bottom: 4pt;
          border-bottom: 2px solid #000;
        }
        .print-root .print-overlay table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9pt;
        }
        .print-root .print-overlay th {
          background: #f0f0f0;
          font-weight: 600;
          text-align: left;
          padding: 4pt 6pt;
          border: 1px solid #000;
        }
        .print-root .print-overlay td {
          padding: 3pt 6pt;
          border: 1px solid #000;
          vertical-align: top;
        }
        .print-root .print-overlay .print-total {
          text-align: right;
          font-weight: 600;
          margin-top: 6pt;
          font-size: 10pt;
        }
        .print-root .print-overlay .print-grand-total {
          text-align: right;
          font-weight: 700;
          margin-top: 16pt;
          font-size: 12pt;
          border-top: 2px solid #000;
          padding-top: 6pt;
        }
        @media print {
          .print-root .print-overlay {
            position: static;
            padding: 5mm;
            overflow: visible;
          }
        }
      `}</style>
      <div className="print-overlay">
        <p className="print-org">{currentOrg?.name ?? ''}</p>
        <p className="print-date">{dayjs(date).format('DD.MM.YYYY')}</p>

        {objBindings.map(({ obj, groups, unpaidTotal }, objIdx) => (
          <div key={obj.id}>
            <div className="print-obj-header">{obj.name}</div>

            <table>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>№</th>
                  {printColumns.map((colId) => (
                    <th key={colId}>{HEADER_LABELS[colId] ?? colId}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let rowNum = 0;
                  return groups.map((group) => (
                    <Fragment key={group.counterparty}>
                      {group.invoices.map((invoice) => {
                        rowNum++;
                        return (
                          <tr key={invoice.id}>
                            <td>{rowNum}</td>
                            {printColumns.map((colId) => (
                              <td key={colId}>{cellText(colId, invoice)}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </Fragment>
                  ));
                })()}
              </tbody>
            </table>

            <div className="print-total">
              Итого по «{obj.name}»: {formatAmountRub(unpaidTotal)}
            </div>
          </div>
        ))}

        <div className="print-grand-total">
          ОБЩИЙ ИТОГО: {formatAmountRub(grandTotal)}
        </div>
      </div>
    </div>,
    document.body,
  );
}
