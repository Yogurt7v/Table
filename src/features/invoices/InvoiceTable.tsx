import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCircleCheckFilled } from '@tabler/icons-react';
import type {
  IAccountingObject,
  IInvoice,
  IInvoiceFile,
  IPaymentMark,
  InvoiceColumnId,
} from '@/shared/types';

import {
  createEmptyDraft,
  validateDraftForm,
  isDraftDirty,
  type DraftInvoiceForm,
} from './invoice-field-access';
import { useInvoicePermissions } from '@/shared/hooks/useInvoicePermissions';
import { useBeforeUnloadGuard } from '@/shared/hooks/useBeforeUnloadGuard';
import { useCreateInvoice } from '@/shared/hooks/useCreateInvoice';
import { useUpdateInvoice } from '@/shared/hooks/useUpdateInvoice';
import { useDeleteInvoice } from '@/shared/hooks/useDeleteInvoice';
import { useMoveInvoice } from '@/shared/hooks/useMoveInvoice';
import { useReorderCounterparties } from '@/shared/hooks/useReorderCounterparties';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { useCreatePaymentMark, useDeletePaymentMark } from '@/shared/hooks/usePaymentMarks';
import { APPROVAL_MARK_STATUS, PARTIAL_MARK_STATUS, PAID_MARK_STATUS } from './payment-mark-status';
import { useCreateInvoiceFile } from '@/shared/hooks/useInvoiceFiles';
import { useCounterpartySearch } from '@/shared/hooks/useCounterpartySearch';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { InvoiceHistoryModal } from './InvoiceHistoryModal';
import { InvoiceMoveModal } from './InvoiceMoveModal';
import { InvoiceEditModal } from './InvoiceEditModal';
import { InvoiceFilesModal } from './InvoiceFilesModal';
import { buildInvoiceDelta } from '@/features/invoices/utils/build-invoice-delta';
import { findDuplicateInvoices, syncInvoiceCopy } from '@/api/collections';
import { GroupedInvoiceTable } from './GroupedInvoiceTable';

interface InvoiceTableProps {
  orgId: string;
  objectId: string;
  date: string;
  invoices: IInvoice[];
  highlightedIds: string[];
  isDraftOpen: boolean;
  hasDraftElsewhere?: boolean;
  onOpenDraft?: (objectId: string) => void;
  onCancelDraft: () => void;
  accountingObjects: IAccountingObject[];
  paymentMarks?: IPaymentMark[];
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  visibleColumns: InvoiceColumnId[];
  onAddClick?: () => void;
  allInvoices?: IInvoice[];
}

export function InvoiceTable({
  orgId,
  objectId,
  date,
  invoices,
  highlightedIds,
  isDraftOpen,
  hasDraftElsewhere = false,
  onOpenDraft,
  onCancelDraft,
  accountingObjects,
  paymentMarks,
  filesByInvoice,
  visibleColumns,
  onAddClick,
  allInvoices,
}: InvoiceTableProps) {
  const permissions = useInvoicePermissions(orgId);
  const queryClient = useQueryClient();
  const createInvoice = useCreateInvoice(orgId, date);
  const updateInvoice = useUpdateInvoice(orgId, date);
  const deleteInvoice = useDeleteInvoice(orgId, date);
  const moveInvoice = useMoveInvoice(orgId, date);
  const createPaymentMark = useCreatePaymentMark(orgId);
  const deletePaymentMark = useDeletePaymentMark(orgId);
  const createInvoiceFile = useCreateInvoiceFile(orgId);
  const reorderCounterparties = useReorderCounterparties(orgId);

  const counterpartyOrder = accountingObjects.find((obj) => obj.id === objectId)?.counterparty_order;

  const handleReorderGroups = (newOrder: string[]) => {
    const stored = counterpartyOrder ?? [];
    const merged = [...newOrder, ...stored.filter((cp) => !newOrder.includes(cp))];
    reorderCounterparties.mutate({ objectId, counterpartyOrder: merged });
  };

  const [draftForm, setDraftForm] = useState<DraftInvoiceForm>(createEmptyDraft);
  const counterpartySearch = useCounterpartySearch(orgId, draftForm.counterparty);
  const [duplicateInvoices, setDuplicateInvoices] = useState<IInvoice[]>([]);
  const [pendingDuplicateForm, setPendingDuplicateForm] = useState<DraftInvoiceForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IInvoice | null>(null);
  const [clearMarkTarget, setClearMarkTarget] = useState<string | null>(null);
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

  useBeforeUnloadGuard(isDraftOpen && isDraftDirty(draftForm));

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
    const invoiceNo = draftForm.invoice_no.trim();
    if (invoiceNo !== '-') {
      const duplicates = await findDuplicateInvoices(orgId, invoiceNo).catch(() => []);
      if (duplicates.length > 0) {
        setDuplicateInvoices(duplicates);
        setPendingDuplicateForm(draftForm);
        return;
      }
    }
    await performCreateInvoice(draftForm);
  };

  const performCreateInvoice = async (form: DraftInvoiceForm) => {
    let created;
    try {
      created = await createInvoice.mutateAsync({
        organization_id: orgId,
        accounting_object_id: objectId,
        date,
        counterparty: form.counterparty.trim(),
        purpose: form.purpose.trim(),
        contract_no: form.contract_no.trim(),
        invoice_no: form.invoice_no.trim(),
        amount: form.amount,
        paid: form.paid,
        paid_date: form.paid_date,
        comment: form.comment.trim(),
      });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось создать счёт' });
      return;
    }
    if (form.file && created?.id) {
      try {
        await createInvoiceFile.mutateAsync({
          invoiceId: created.id,
          file: form.file,
          name: form.file.name,
        });
      } catch {
        notifications.show({
          color: 'yellow',
          title: 'Счёт добавлен',
          message: 'Файл не загрузился — прикрепите его через меню «Файлы»',
          autoClose: 10000,
        });
      }
    }
    onCancelDraft();
    notifications.show({
      color: 'green',
      icon: <IconCircleCheckFilled size={20} />,
      title: 'Счёт добавлен',
      message: `${form.counterparty} · ${formatAmountRub(form.amount)}`,
      autoClose: 4500,
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-green-0)',
          borderLeft: '4px solid var(--mantine-color-green-6)',
          boxShadow: 'var(--mantine-shadow-md)',
        },
        title: { fontWeight: 700 },
      },
    });
  };

  const handleEditInvoice = (data: DraftInvoiceForm) => {
    if (!editInvoice) return;

    const suffix = (editInvoice as IInvoice & { _syntheticSuffix?: string | null })
      ._syntheticSuffix;

    if (suffix) {
      const copyComments = { ...(editInvoice.copy_comments ?? {}), [suffix]: data.comment };
      if (!data.comment) delete copyComments[suffix];
      updateInvoice.mutate(
        {
          id: editInvoice.id,
          previousData: { copy_comments: editInvoice.copy_comments },
          copy_comments: copyComments,
        },
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

    const { updates, previousData, changed } = buildInvoiceDelta(
      data,
      editInvoice,
      date.slice(0, 10),
    );
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
    const remaining = (Number(invoice.amount) || 0) - newAmounts.reduce((s, a) => s + (Number(a) || 0), 0);
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
          ? { amount: existingMark.amount ?? null, comment: existingMark.comment ?? '', status: existingMark.status }
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
  };

  const handleClearPayment = (invoiceId: string) => {
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
      remaining: (Number(invoice.amount) || 0) - newAmounts.reduce((s, a) => s + (Number(a) || 0), 0),
      removed_amount: invoice.paid_amount ?? null,
    };
    updateInvoice.mutate(
      {
        id: originalId,
        previousData,
        paid: newAmounts.length > 0,
        payment_amounts: newAmounts,
        paid_amount: newAmounts.length > 0 ? newAmounts[newAmounts.length - 1]! : null,
        paid_date: newAmounts.length > 0 ? invoice.paid_date : null,
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
          void syncInvoiceCopy(invoice, newAmounts, newAmounts.length > 0, invoice.paid_date || date.slice(0, 10)).then(() => {
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
  };

  const handleMarkForPayment = (invoice: IInvoice) => {
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
  };

  const handleMarkForApproval = (invoice: IInvoice) => {
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
  };

  const handleMarkPartialPayment = (
    invoiceId: string,
    amount: number | undefined,
    comment: string,
  ) => {
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
  };

  const handleClearPaymentMark = (markId: string) => {
    setClearMarkTarget(markId);
  };

  const patchDraft = (patch: Partial<DraftInvoiceForm>) => {
    setDraftForm((prev) => ({ ...prev, ...patch }));
  };

  return (
    <>
      <GroupedInvoiceTable
        orgId={orgId}
        invoices={invoices}
        allInvoices={allInvoices}
        counterpartyOrder={counterpartyOrder}
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
          const copyComment = suffix ? (realInvoice?.copy_comments?.[suffix] ?? '') : undefined;
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
        onMarkForApproval={handleMarkForApproval}
        onMarkPartialPayment={handleMarkPartialPayment}
        onClearPaymentMark={handleClearPaymentMark}
        filesByInvoice={filesByInvoice}
        onFiles={(inv) => setFilesInvoice(inv)}
        visibleColumns={visibleColumns}
        onReorderGroups={handleReorderGroups}
        onAddClick={onAddClick}
        hasDraftElsewhere={hasDraftElsewhere}
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
      <ConfirmModal
        opened={duplicateInvoices.length > 0}
        onClose={() => {
          setDuplicateInvoices([]);
          setPendingDuplicateForm(null);
        }}
        onConfirm={() => {
          const form = pendingDuplicateForm;
          setDuplicateInvoices([]);
          setPendingDuplicateForm(null);
          if (form) void performCreateInvoice(form);
        }}
        title="Возможный дубль счёта"
        color="yellow"
        confirmLabel="Создать всё равно"
        cancelLabel="Отмена"
        message={
          <Stack gap="xs">
            <Text size="sm">Такой счёт уже существует:</Text>
            {duplicateInvoices.map((inv) => (
              <Text key={inv.id} size="sm" c="dimmed">
                {inv.date} · {inv.counterparty} · {formatAmountRub(inv.amount)}
              </Text>
            ))}
            <Text size="sm">Создать дубль счёта «{duplicateInvoices[0]?.invoice_no}»?</Text>
          </Stack>
        }
      />
      <ConfirmModal
        opened={!!clearMarkTarget}
        onClose={() => setClearMarkTarget(null)}
        onConfirm={() => {
          if (clearMarkTarget) {
            deletePaymentMark.mutate(clearMarkTarget, {
              onSuccess: () => {
                notifications.show({ color: 'green', message: 'Отметка удалена' });
              },
              onError: () => {
                notifications.show({ color: 'red', message: 'Не удалось удалить отметку' });
              },
            });
          }
          setClearMarkTarget(null);
        }}
        title="Снятие отметки"
        message="Убрать отметку к оплате с этого счёта?"
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
