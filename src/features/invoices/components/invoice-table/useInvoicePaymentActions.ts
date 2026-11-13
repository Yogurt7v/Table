import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useUpdateInvoice } from '@/shared/hooks/useUpdateInvoice';
import { useDeletePaymentMark } from '@/shared/hooks/usePaymentMarks';
import { useCreatePaymentMark } from '@/shared/hooks/usePaymentMarks';
import { useApprovePaymentMark } from '@/shared/hooks/usePaymentMarks';
import { syncInvoiceCopy } from '@/api/collections';
import type { IInvoice, IPaymentMark } from '@/shared/types';
import { PAID_MARK_STATUS, APPROVAL_MARK_STATUS, PARTIAL_MARK_STATUS } from '@/features/invoices/payment-mark-status';

interface UseInvoicePaymentActionsProps {
  orgId: string;
  date: string;
  invoices: IInvoice[];
  paymentMarks?: IPaymentMark[];
  permissions: {
    canPay: boolean;
    canMarkPayment: boolean;
    canViewPaymentMarks: boolean;
  };
}

export function useInvoicePaymentActions({
  orgId,
  date,
  invoices,
  paymentMarks,
}: UseInvoicePaymentActionsProps) {
  const queryClient = useQueryClient();
  const updateInvoice = useUpdateInvoice(orgId, date);
  const createPaymentMark = useCreatePaymentMark(orgId);
  const deletePaymentMark = useDeletePaymentMark(orgId);
  const approvePaymentMark = useApprovePaymentMark(orgId);
  const [clearMarkTarget, setClearMarkTarget] = useState<string | null>(null);

  const handlePayInvoice = useCallback(
    (invoiceId: string, amount: number) => {
      const invoice = invoices.find((i) => i.id === invoiceId);
      if (!invoice) return;
      const newAmounts = [...(invoice.payment_amounts ?? []), amount];
      const remaining =
        (Number(invoice.amount) || 0) - newAmounts.reduce((s, a) => s + (Number(a) || 0), 0);
      const existingMark = paymentMarks?.find((m) => m.invoice_id === invoiceId);
      const previousData: Record<string, unknown> = {
        paid: invoice.paid,
        payment_amounts: invoice.payment_amounts,
        paid_amount: invoice.paid_amount,
        paid_date: invoice.paid_date,
        remaining,
        payment: amount,
      };
      updateInvoice.mutate(
        {
          id: invoiceId,
          previousData,
          paid: true,
          payment_amounts: newAmounts,
          paid_amount: amount,
          paid_date: date.slice(0, 10),
          last_deleted_mark: existingMark
            ? {
                amount: existingMark.amount ?? null,
                comment: existingMark.comment ?? '',
                status: existingMark.status ?? 'proposed',
              }
            : undefined,
        },
        {
          onSuccess: () => {
            if (existingMark) {
              deletePaymentMark.mutate(existingMark.id, {
                onError: () => {
                  notifications.show({ color: 'red', message: 'Не удалось удалить отметку' });
                },
              });
            }
            void syncInvoiceCopy(invoice, newAmounts, true, date.slice(0, 10)).then(() => {
              queryClient.invalidateQueries({ queryKey: ['invoices', orgId] });
              queryClient.invalidateQueries({ queryKey: ['invoice_files', orgId] });
            });
            notifications.show({ color: 'green', message: 'Статус счёта обновлён' });
          },
          onError: (error) => {
            console.error('Ошибка при обновлении статуса оплаты:', error);
            notifications.show({ color: 'red', message: 'Не удалось обновить статус счёта' });
          },
        },
      );
    },
    [invoices, paymentMarks, updateInvoice, deletePaymentMark, queryClient, orgId, date],
  );

  const handleClearPayment = useCallback(
    (invoiceId: string) => {
      const originalId = invoiceId.replace(/__p\d+$/, '');
      const invoice = invoices.find((i) => i.id === originalId);
      if (!invoice) return;
      const amounts = invoice.payment_amounts ?? [];
      if (amounts.length === 0) return;
      const newAmounts = amounts.slice(0, -1);
      const savedMark = invoice.last_deleted_mark;
      const previousData: Record<string, unknown> = {
        paid: invoice.paid,
        payment_amounts: invoice.payment_amounts,
        paid_amount: invoice.paid_amount,
        paid_date: invoice.paid_date,
        remaining:
          (Number(invoice.amount) || 0) - newAmounts.reduce((s, a) => s + (Number(a) || 0), 0),
        removed_amount: invoice.paid_amount ?? null,
      };
      updateInvoice.mutate(
        {
          id: originalId,
          previousData,
          paid: newAmounts.length > 0,
          payment_amounts: newAmounts,
          paid_amount: newAmounts.length > 0 ? newAmounts[newAmounts.length - 1]! : null,
          paid_date: newAmounts.length > 0 ? invoice.paid_date : (null as unknown as string),
          last_deleted_mark: null,
        },
        {
          onSuccess: () => {
            if (savedMark) {
              createPaymentMark.mutate({
                invoice_id: originalId,
                amount: savedMark.amount,
                comment: savedMark.comment,
                status: savedMark.status,
              });
            }
            void syncInvoiceCopy(
              invoice,
              newAmounts,
              newAmounts.length > 0,
              invoice.paid_date || date.slice(0, 10),
            ).then(() => {
              queryClient.invalidateQueries({ queryKey: ['invoices', orgId] });
              queryClient.invalidateQueries({ queryKey: ['invoice_files', orgId] });
            });
            notifications.show({ color: 'green', message: 'Оплата снята' });
          },
          onError: (error) => {
            console.error('Ошибка при снятии оплаты:', error);
            notifications.show({ color: 'red', message: 'Не удалось снять оплату' });
          },
        },
      );
    },
    [invoices, updateInvoice, createPaymentMark, queryClient, orgId, date],
  );

  const handleMarkForPayment = useCallback(
    (invoice: IInvoice) => {
      const realId = invoice.id.endsWith('__r') ? invoice.id.slice(0, -3) : invoice.id;
      createPaymentMark.mutate(
        { invoice_id: realId, amount: invoice.amount, status: PAID_MARK_STATUS },
        {
          onSuccess: () => {
            notifications.show({ color: 'green', message: 'Счёт отмечен к оплате' });
          },
          onError: () => {
            notifications.show({ color: 'red', message: 'Не удалось отметить счёт' });
          },
        },
      );
    },
    [createPaymentMark],
  );

  const handleMarkForApproval = useCallback(
    (invoice: IInvoice) => {
      const realId = invoice.id.endsWith('__r') ? invoice.id.slice(0, -3) : invoice.id;
      createPaymentMark.mutate(
        { invoice_id: realId, amount: invoice.amount, status: APPROVAL_MARK_STATUS },
        {
          onSuccess: () => {
            notifications.show({ color: 'green', message: 'Счёт отправлен на согласование' });
          },
          onError: () => {
            notifications.show({ color: 'red', message: 'Не удалось отметить счёт' });
          },
        },
      );
    },
    [createPaymentMark],
  );

  const handleMarkPartialPayment = useCallback(
    (invoiceId: string, amount: number | undefined, comment: string) => {
      const realId = invoiceId.endsWith('__r') ? invoiceId.slice(0, -3) : invoiceId;
      createPaymentMark.mutate(
        { invoice_id: realId, amount, comment, status: PARTIAL_MARK_STATUS },
        {
          onSuccess: () => {
            notifications.show({ color: 'green', message: 'Частичная оплата отмечена' });
          },
          onError: () => {
            notifications.show({ color: 'red', message: 'Не удалось отметить частичную оплату' });
          },
        },
      );
    },
    [createPaymentMark],
  );

  const handleClearPaymentMark = (markId: string) => {
    setClearMarkTarget(markId);
  };

  const handleApproveMark = (markId: string) => {
    approvePaymentMark.mutate(markId, {
      onSuccess: () => {
        notifications.show({ color: 'green', message: 'Счёт отмечен к оплате' });
      },
      onError: () => {
        notifications.show({ color: 'red', message: 'Не удалось утвердить оплату' });
      },
    });
  };

  return {
    clearMarkTarget,
    setClearMarkTarget,
    handlePayInvoice,
    handleClearPayment,
    handleMarkForPayment,
    handleMarkForApproval,
    handleMarkPartialPayment,
    handleClearPaymentMark,
    handleApproveMark,
  };
}
