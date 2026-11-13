import { useState, useCallback, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { useCreateInvoice } from '@/shared/hooks/useCreateInvoice';
import { useCreateInvoiceFile } from '@/shared/hooks/useInvoiceFiles';
import { useCounterpartySearch } from '@/shared/hooks/useCounterpartySearch';
import { validateDraftForm, createEmptyDraft, type DraftInvoiceForm } from '@/features/invoices/invoice-field-access';
import { findDuplicateInvoices } from '@/api/collections';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { IconCircleCheckFilled } from '@tabler/icons-react';
import type { IInvoice } from '@/shared/types';

interface UseInvoiceDraftProps {
  orgId: string;
  objectId: string;
  date: string;
  onDraftCancel: () => void;
  onOpenDraft: (objectId: string) => void;
}

export function useInvoiceDraft({
  orgId,
  objectId,
  date,
  onDraftCancel,
  onOpenDraft,
}: UseInvoiceDraftProps) {
  const [draftForm, setDraftForm] = useState<DraftInvoiceForm>(createEmptyDraft);
  const [duplicateInvoices, setDuplicateInvoices] = useState<IInvoice[]>([]);
  const [pendingDuplicateForm, setPendingDuplicateForm] = useState<DraftInvoiceForm | null>(null);
  const copySourceRef = useRef<IInvoice | null>(null);

  const createInvoice = useCreateInvoice(orgId, date);
  const createInvoiceFile = useCreateInvoiceFile(orgId);
  const counterpartySearch = useCounterpartySearch(orgId, draftForm.counterparty);

  const patchDraft = (patch: Partial<DraftInvoiceForm>) => {
    setDraftForm((prev) => ({ ...prev, ...patch }));
  };

  const handleCopy = useCallback(
    (invoice: IInvoice) => {
      copySourceRef.current = invoice;
      onOpenDraft(normalizeRelationId(invoice.accounting_object_id));
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
    onDraftCancel();
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

  return {
    draftForm,
    setDraftForm,
    duplicateInvoices,
    pendingDuplicateForm,
    copySourceRef,
    handleCopy,
    handleSaveDraft,
    patchDraft,
    counterpartySearch,
    performCreateInvoice,
  };
}
