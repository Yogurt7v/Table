import { useState, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import type {
  IAccountingObject,
  IInvoice,
  IInvoiceFile,
  IPaymentMark,
  InvoiceColumnId,
} from '@/shared/types';

import { type DraftInvoiceForm } from '@/features/invoices/model/invoice-field-access';
import { useInvoicePermissions } from '@/features/invoices/hooks/useInvoicePermissions';
import { useOrganizationUsers } from '@/features/admin/hooks/useOrganizationUsers';
import { useUpdateInvoice } from '@/features/invoices/hooks/useUpdateInvoice';
import { useDeleteInvoice } from '@/features/invoices/hooks/useDeleteInvoice';
import { useMoveInvoice } from '@/features/invoices/hooks/useMoveInvoice';
import { useReorderCounterparties } from '@/features/invoices/hooks/useReorderCounterparties';
import { useInvoiceDraft } from '@/features/invoices/ui/invoice-table/useInvoiceDraft.tsx';
import { useInvoicePaymentActions } from '@/features/invoices/ui/invoice-table/useInvoicePaymentActions';
import { InvoiceTableDeleteConfirm } from '@/features/invoices/ui/invoice-table/InvoiceTableDeleteConfirm';
import { InvoiceTableDuplicateConfirm } from '@/features/invoices/ui/invoice-table/InvoiceTableDuplicateConfirm';
import { InvoiceTableClearMarkConfirm } from '@/features/invoices/ui/invoice-table/InvoiceTableClearMarkConfirm';
import { GroupedInvoiceTable } from '../grouped-invoice-table/GroupedInvoiceTable';
import { InvoiceHistoryModal } from '../invoice-history-modal/InvoiceHistoryModal';
import { InvoiceMoveModal } from '../invoice-move-modal/InvoiceMoveModal';
import { InvoiceEditModal } from '../invoice-edit-modal/InvoiceEditModal';
import { InvoiceFilesModal } from '../invoice-files-modal/InvoiceFilesModal';
import { buildInvoiceDelta } from '@/features/invoices/utils/build-invoice-delta';

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

/** `expand-invoice-rows.ts` даёт копии частичных оплат синтетический id `abc123__p0`; в API есть только `abc123`. */
function toRealInvoiceId(invoiceId: string): string {
  const markerIndex = invoiceId.indexOf('__');
  return markerIndex === -1 ? invoiceId : invoiceId.slice(0, markerIndex);
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
  const { data: orgUsers } = useOrganizationUsers();
  const updateInvoice = useUpdateInvoice(orgId, date);
  const deleteInvoice = useDeleteInvoice(orgId, date);
  const moveInvoice = useMoveInvoice(orgId, date);
  const reorderCounterparties = useReorderCounterparties(orgId);
  const initiatorOptions = useMemo(() => {
    if (!orgUsers) return [];
    return orgUsers
      .filter((ou) => ou.organization_id === orgId)
      .flatMap((ou) => {
        const user = ou.expand?.user_id;
        return user ? [{ value: user.id, label: user.name || user.login || user.email }] : [];
      });
  }, [orgUsers, orgId]);
  const initiatorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (orgUsers) {
      for (const ou of orgUsers) {
        if (ou.organization_id !== orgId) continue;
        const user = ou.expand?.user_id;
        if (!user) continue;
        map.set(user.id, user.name || user.login || user.email);
      }
    }
    return map;
  }, [orgUsers, orgId]);

  const counterpartyOrder = accountingObjects.find(
    (obj) => obj.id === objectId,
  )?.counterparty_order;

  const handleReorderGroups = (newOrder: string[]) => {
    const stored = counterpartyOrder ?? [];
    const merged = [...newOrder, ...stored.filter((cp) => !newOrder.includes(cp))];
    reorderCounterparties.mutate({ objectId, counterpartyOrder: merged });
  };

  const {
    draftForm,
    duplicateInvoices,
    setDuplicateInvoices,
    pendingDuplicateForm,
    setPendingDuplicateForm,
    handleCopy,
    handleSaveDraft,
    patchDraft,
    counterpartySearch,
    performCreateInvoice,
  } = useInvoiceDraft({
    orgId,
    objectId,
    date,
    isDraftOpen,
    onDraftCancel: onCancelDraft,
    onOpenDraft,
  });

  const {
    clearMarkTarget,
    setClearMarkTarget,
    deletePaymentMark,
    handlePayInvoice,
    handleClearPayment,
    handleMarkForPayment,
    handleMarkForApproval,
    handleMarkPartialPayment,
    handleClearPaymentMark,
    handleApproveMark,
  } = useInvoicePaymentActions({
    orgId,
    date,
    invoices,
    paymentMarks,
    permissions,
  });

  const [deleteTarget, setDeleteTarget] = useState<IInvoice | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [historyInvoice, setHistoryInvoice] = useState<IInvoice | null>(null);
  const [moveInvoiceTarget, setMoveInvoiceTarget] = useState<IInvoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<IInvoice | null>(null);
  const [filesInvoice, setFilesInvoice] = useState<IInvoice | null>(null);

  /**
   * Строка-копия частичной оплаты (`abc123__p0`) — это не отдельный счёт: правится
   * комментарий копии, а запись уходит в исходный счёт. Поэтому реальный id и
   * суффикс разбираются здесь, а `handleEditInvoice` уже дописывает комментарий.
   */
  const handleOpenEdit = (invoice: IInvoice) => {
    const realId = toRealInvoiceId(invoice.id);
    const suffix = realId === invoice.id ? null : invoice.id.slice(realId.length);
    const realInvoice = suffix ? invoices.find((i) => i.id === realId) : null;
    const copyComment = suffix ? (realInvoice?.copy_comments?.[suffix] ?? '') : undefined;
    setEditInvoice({
      ...invoice,
      id: realId,
      comment: copyComment ?? invoice.comment,
      _syntheticSuffix: suffix,
    } as IInvoice & { _syntheticSuffix?: string | null });
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
      (userId) => initiatorNameMap.get(userId) ?? '',
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
        onEdit={handleOpenEdit}
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
        onApproveMark={handleApproveMark}
        filesByInvoice={filesByInvoice}
        onFiles={(inv) => setFilesInvoice(inv)}
        visibleColumns={visibleColumns}
        onReorderGroups={handleReorderGroups}
        onAddClick={onAddClick}
        hasDraftElsewhere={hasDraftElsewhere}
      />
      <InvoiceTableDeleteConfirm
        opened={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteReason('');
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteInvoice.mutate({
              id: toRealInvoiceId(deleteTarget.id),
              reason: deleteReason.trim(),
            });
          }
          setDeleteTarget(null);
          setDeleteReason('');
        }}
        deleteTarget={deleteTarget}
        deleteReason={deleteReason}
        setDeleteReason={setDeleteReason}
        loading={deleteInvoice.isPending}
      />
      <InvoiceTableDuplicateConfirm
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
        duplicateInvoices={duplicateInvoices}
        pendingDuplicateForm={pendingDuplicateForm}
      />
      <InvoiceTableClearMarkConfirm
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
        initiatorOptions={initiatorOptions}
        canEditInitiator={editInvoice ? permissions.canEditField('created_by') : false}
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
