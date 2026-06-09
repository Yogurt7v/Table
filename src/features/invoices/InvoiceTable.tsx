import { useState, useEffect, useCallback, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import type { IAccountingObject, IInvoice, IInvoiceFile, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import { createEmptyDraft, validateDraftForm, type DraftInvoiceForm } from './invoice-field-access';
import { useInvoicePermissions } from '@/shared/hooks/useInvoicePermissions';
import { useCreateInvoice } from '@/shared/hooks/useCreateInvoice';
import { useUpdateInvoice } from '@/shared/hooks/useUpdateInvoice';
import { useDeleteInvoice } from '@/shared/hooks/useDeleteInvoice';
import { useMoveInvoice } from '@/shared/hooks/useMoveInvoice';
import { useReorderInvoices } from '@/shared/hooks/useReorderInvoices';
import { groupInvoicesByCounterparty } from '@/shared/utils/group-invoices';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { useCreatePaymentMark, useDeletePaymentMark } from '@/shared/hooks/usePaymentMarks';
import { useCreateInvoiceFile } from '@/shared/hooks/useInvoiceFiles';
import { useCounterpartySearch } from '@/shared/hooks/useCounterpartySearch';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { InvoiceHistoryModal } from './InvoiceHistoryModal';
import { InvoiceMoveModal } from './InvoiceMoveModal';
import { InvoiceEditModal } from './InvoiceEditModal';
import { InvoiceFilesModal } from './InvoiceFilesModal';
import { buildInvoiceDelta } from '@/features/invoices/utils/build-invoice-delta';
import { GroupedInvoiceTable } from './GroupedInvoiceTable';

interface InvoiceTableProps {
  orgId: string;
  objectId: string;
  date: string;
  invoices: IInvoice[];
  highlightedIds: string[];
  isDraftOpen: boolean;
  onOpenDraft?: (objectId: string) => void;
  onCancelDraft: () => void;
  accountingObjects: IAccountingObject[];
  paymentMarks?: IPaymentMark[];
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  visibleColumns: InvoiceColumnId[];
}

export function InvoiceTable({
  orgId,
  objectId,
  date,
  invoices,
  highlightedIds,
  isDraftOpen,
  onOpenDraft,
  onCancelDraft,
  accountingObjects,
  paymentMarks,
  filesByInvoice,
  visibleColumns,
}: InvoiceTableProps) {
  const permissions = useInvoicePermissions(orgId);
  const createInvoice = useCreateInvoice(orgId, date);
  const updateInvoice = useUpdateInvoice(orgId, date);
  const deleteInvoice = useDeleteInvoice(orgId, date);
  const moveInvoice = useMoveInvoice(orgId, date);
  const createPaymentMark = useCreatePaymentMark(orgId);
  const deletePaymentMark = useDeletePaymentMark(orgId);
  const createInvoiceFile = useCreateInvoiceFile(orgId);
  const reorderInvoices = useReorderInvoices(orgId, date);

  const handleReorderGroups = (counterpartyOrder: string[]) => {
    const groups = groupInvoicesByCounterparty(invoices);
    const map = new Map(groups.map((g) => [g.counterparty, g.invoices]));
    const flatIds = counterpartyOrder.flatMap((cp) => {
      const g = map.get(cp);
      return g ? g.map((inv) => inv.id) : [];
    });
    reorderInvoices.mutate(flatIds);
  };

  const [draftForm, setDraftForm] = useState<DraftInvoiceForm>(createEmptyDraft);
  const counterpartySearch = useCounterpartySearch(orgId, draftForm.counterparty);
  const [deleteTarget, setDeleteTarget] = useState<IInvoice | null>(null);
  const [historyInvoice, setHistoryInvoice] = useState<IInvoice | null>(null);
  const [moveInvoiceTarget, setMoveInvoiceTarget] = useState<IInvoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<IInvoice | null>(null);
  const [filesInvoice, setFilesInvoice] = useState<IInvoice | null>(null);
  const copySourceRef = useRef<IInvoice | null>(null);

  useEffect(() => {
    if (isDraftOpen) {
      if (copySourceRef.current) {
        const src = copySourceRef.current;
        copySourceRef.current = null;
        setDraftForm({
          counterparty: src.counterparty,
          purpose: src.purpose,
          contract_no: src.contract_no,
          invoice_no: src.invoice_no,
          amount: src.amount,
          paid: false,
          paid_date: '',
          comment: src.comment,
        });
      } else {
        setDraftForm(createEmptyDraft());
      }
    }
  }, [isDraftOpen]);

  const handleCopy = useCallback(
    (invoice: IInvoice) => {
      copySourceRef.current = invoice;
      onOpenDraft?.(normalizeRelationId(invoice.accounting_object_id));
    },
    [onOpenDraft],
  );

  const handleSaveDraft = async () => {
    const error = validateDraftForm(draftForm);
    if (error) {
      notifications.show({ color: 'red', message: error });
      return;
    }
    try {
      const created = await createInvoice.mutateAsync({
        organization_id: orgId,
        accounting_object_id: objectId,
        date,
        counterparty: draftForm.counterparty.trim(),
        purpose: draftForm.purpose.trim(),
        contract_no: draftForm.contract_no.trim(),
        invoice_no: draftForm.invoice_no.trim(),
        amount: draftForm.amount,
        paid: draftForm.paid,
        paid_date: draftForm.paid_date,
        comment: draftForm.comment.trim(),
      });
      if (draftForm.file && created?.id) {
        await createInvoiceFile.mutateAsync({
          invoiceId: created.id,
          file: draftForm.file,
          name: draftForm.file.name,
        });
      }
      onCancelDraft();
      notifications.show({ color: 'green', message: 'Счёт добавлен' });
    } catch (err) {
      console.error('Ошибка создания счёта:', err);
      notifications.show({ color: 'red', message: 'Не удалось создать счёт' });
    }
  };

  const handleEditInvoice = (data: DraftInvoiceForm) => {
    if (!editInvoice) return;

    const suffix = (editInvoice as IInvoice & { _syntheticSuffix?: string | null })._syntheticSuffix;

    if (suffix) {
      const copyComments = { ...(editInvoice.copy_comments ?? {}), [suffix]: data.comment };
      if (!data.comment) delete copyComments[suffix];
      updateInvoice.mutate(
        { id: editInvoice.id, previousData: { copy_comments: editInvoice.copy_comments }, copy_comments: copyComments },
        {
          onSuccess: () => {
            setEditInvoice(null);
            notifications.show({ color: 'green', message: 'Комментарий обновлён' });
          },
          onError: () => {
            notifications.show({ color: 'red', message: 'Не удалось обновить комментарий' });
          },
        },
      );
      return;
    }

    const { updates, previousData, changed } = buildInvoiceDelta(data, editInvoice, date.slice(0, 10));
    if (!changed) {
      setEditInvoice(null);
      return;
    }
    updateInvoice.mutate(
      { id: editInvoice.id, previousData, ...updates },
      {
        onSuccess: () => {
          setEditInvoice(null);
          notifications.show({ color: 'green', message: 'Счёт обновлён' });
        },
        onError: () => {
          notifications.show({ color: 'red', message: 'Не удалось обновить счёт' });
        },
      },
    );
  };

  const handlePayInvoice = (invoiceId: string, amount: number) => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return;
    const newAmounts = [...(invoice.payment_amounts ?? []), amount];
    const previousData: Record<string, unknown> = {
      paid: invoice.paid,
      payment_amounts: invoice.payment_amounts,
      paid_amount: invoice.paid_amount,
      paid_date: invoice.paid_date,
    };
    updateInvoice.mutate(
      {
        id: invoiceId,
        previousData,
        paid: true,
        payment_amounts: newAmounts,
        paid_amount: amount,
        paid_date: date.slice(0, 10),
      },
      {
        onSuccess: () => {
          const existingMark = paymentMarks?.find((m) => m.invoice_id === invoiceId);
          if (existingMark) {
            deletePaymentMark.mutate(existingMark.id);
          }
          notifications.show({ color: 'green', message: 'Статус счёта обновлён' });
        },
        onError: (error) => {
          console.error('Ошибка при обновлении статуса оплаты:', error);
          notifications.show({ color: 'red', message: 'Не удалось обновить статус счёта' });
        },
      },
    );
  };

  const handleClearPayment = (invoiceId: string) => {
    const originalId = invoiceId.replace(/__p\d+$/, '');
    const invoice = invoices.find((i) => i.id === originalId);
    if (!invoice) return;
    const amounts = invoice.payment_amounts ?? [];
    if (amounts.length === 0) return;
    const newAmounts = amounts.slice(0, -1);
    const previousData: Record<string, unknown> = {
      paid: invoice.paid,
      payment_amounts: invoice.payment_amounts,
      paid_amount: invoice.paid_amount,
      paid_date: invoice.paid_date,
    };
    updateInvoice.mutate(
      {
        id: originalId,
        previousData,
        paid: newAmounts.length > 0,
        payment_amounts: newAmounts,
        paid_amount: newAmounts.length > 0 ? newAmounts[newAmounts.length - 1]! : null,
        paid_date: newAmounts.length > 0 ? invoice.paid_date : null,
      },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Оплата снята' });
        },
        onError: (error) => {
          console.error('Ошибка при снятии оплаты:', error);
          notifications.show({ color: 'red', message: 'Не удалось снять оплату' });
        },
      },
    );
  };

  const handleMarkForPayment = (invoice: IInvoice) => {
    const realId = invoice.id.endsWith('__r') ? invoice.id.slice(0, -3) : invoice.id;
    createPaymentMark.mutate(
      { invoice_id: realId, amount: invoice.amount },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Счёт отмечен к оплате' });
        },
        onError: () => {
          notifications.show({ color: 'red', message: 'Не удалось отметить счёт' });
        },
      },
    );
  };

  const handleMarkPartialPayment = (invoiceId: string, amount: number | undefined, comment: string) => {
    const realId = invoiceId.endsWith('__r') ? invoiceId.slice(0, -3) : invoiceId;
    createPaymentMark.mutate(
      { invoice_id: realId, amount, comment },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Частичная оплата отмечена' });
        },
        onError: () => {
          notifications.show({ color: 'red', message: 'Не удалось отметить частичную оплату' });
        },
      },
    );
  };

  const handleClearPaymentMark = (markId: string) => {
    deletePaymentMark.mutate(markId, {
      onSuccess: () => {
        notifications.show({ color: 'green', message: 'Отметка удалена' });
      },
      onError: () => {
        notifications.show({ color: 'red', message: 'Не удалось удалить отметку' });
      },
    });
  };

  const patchDraft = (patch: Partial<DraftInvoiceForm>) => {
    setDraftForm((prev) => ({ ...prev, ...patch }));
  };

  return (
    <>
      <GroupedInvoiceTable
        orgId={orgId}
        invoices={invoices}
        isDraftOpen={isDraftOpen}
        draftForm={draftForm}
        counterpartyResults={counterpartySearch.results}
        onDraftChange={(field, value) =>
          patchDraft({ [field]: value } as Partial<DraftInvoiceForm>)
        }
        onDraftSave={handleSaveDraft}
        onDraftCancel={onCancelDraft}
        highlightedIds={highlightedIds}
        onEdit={(inv) => {
          const hasSuffix = inv.id.includes('__');
          const suffix = hasSuffix ? inv.id.slice(inv.id.indexOf('__')) : null;
          const realId = hasSuffix ? inv.id.slice(0, inv.id.indexOf('__')) : inv.id;
          const realInvoice = hasSuffix ? invoices.find((i) => i.id === realId) : null;
          const copyComment = suffix ? realInvoice?.copy_comments?.[suffix] ?? '' : undefined;
          setEditInvoice({
            ...inv,
            id: realId,
            comment: copyComment ?? inv.comment,
            _syntheticSuffix: suffix,
          } as IInvoice & { _syntheticSuffix?: string | null });
        }}
        onCopy={handleCopy}
        onDelete={(inv) => setDeleteTarget(inv)}
        onHistory={(inv) => setHistoryInvoice(inv)}
        onMove={(inv) => setMoveInvoiceTarget(inv)}
        onPayInvoice={handlePayInvoice}
        onClearPayment={handleClearPayment}
        permissions={permissions}
        paymentMarks={paymentMarks}
        onMarkForPayment={handleMarkForPayment}
        onMarkPartialPayment={handleMarkPartialPayment}
        onClearPaymentMark={handleClearPaymentMark}
        filesByInvoice={filesByInvoice}
        onFiles={(inv) => setFilesInvoice(inv)}
        visibleColumns={visibleColumns}
        onReorderGroups={handleReorderGroups}
      />
      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteInvoice.mutate(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        title="Удаление счёта"
        message={`Удалить счёт «${deleteTarget?.counterparty || deleteTarget?.invoice_no || ''}»?`}
        loading={deleteInvoice.isPending}
      />
      <InvoiceHistoryModal
        opened={!!historyInvoice}
        invoiceId={historyInvoice?.id ?? null}
        invoiceLabel={historyInvoice?.counterparty || historyInvoice?.invoice_no || ''}
        onClose={() => setHistoryInvoice(null)}
      />
      <InvoiceMoveModal
        opened={!!moveInvoiceTarget}
        onClose={() => setMoveInvoiceTarget(null)}
        objects={accountingObjects}
        currentObjectId={objectId}
        loading={moveInvoice.isPending}
        onConfirm={(targetObjectId) => {
          if (moveInvoiceTarget) {
            moveInvoice.mutate(
              { id: moveInvoiceTarget.id, accounting_object_id: targetObjectId },
              {
                onSuccess: () => {
                  setMoveInvoiceTarget(null);
                  notifications.show({ color: 'green', message: 'Счёт перенесён' });
                },
                onError: () => {
                  notifications.show({ color: 'red', message: 'Не удалось перенести счёт' });
                },
              },
            );
          }
        }}
      />
      <InvoiceEditModal
        opened={!!editInvoice}
        invoice={editInvoice}
        counterpartyResults={counterpartySearch.results}
        onSave={handleEditInvoice}
        loading={updateInvoice.isPending}
        onClose={() => setEditInvoice(null)}
      />
      <InvoiceFilesModal
        opened={!!filesInvoice}
        invoiceId={filesInvoice?.id ?? null}
        invoiceLabel={filesInvoice?.counterparty || filesInvoice?.invoice_no || ''}
        orgId={orgId}
        canManageFiles={permissions.canManageFiles}
        onClose={() => setFilesInvoice(null)}
      />
    </>
  );
}
