import {
  Modal,
  Button,
  Stack,
  TextInput,
  NumberInput,
  Autocomplete,
  Group,
  Textarea,
} from '@mantine/core';
import { useState, useEffect, useMemo } from 'react';
import type { IInvoice } from '@/shared/types';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { useBeforeUnloadGuard } from '@/shared/hooks/useBeforeUnloadGuard';
import type { DraftFieldErrors, DraftInvoiceForm } from './invoice-field-access';
import { createEmptyDraft, validateDraftFields } from './invoice-field-access';

interface InvoiceEditModalProps {
  opened: boolean;
  onClose: () => void;
  invoice?: IInvoice | null;
  counterpartyResults?: string[];
  onSave: (data: DraftInvoiceForm) => void;
  loading?: boolean;
}

export function InvoiceEditModal({
  opened,
  onClose,
  invoice,
  counterpartyResults = [],
  onSave,
  loading,
}: InvoiceEditModalProps) {
  const [form, setForm] = useState<DraftInvoiceForm>(createEmptyDraft());
  const [initialForm, setInitialForm] = useState<DraftInvoiceForm>(createEmptyDraft());
  const [errors, setErrors] = useState<DraftFieldErrors>({});
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const isEditMode = !!invoice;

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (opened) {
      let next: DraftInvoiceForm;
      if (invoice) {
        next = {
          counterparty: invoice.counterparty,
          purpose: invoice.purpose,
          contract_no: invoice.contract_no,
          invoice_no: invoice.invoice_no,
          amount: invoice.amount || 0,
          paid: invoice.paid || false,
          paid_date: invoice.paid_date ?? '',
          comment: invoice.comment ?? '',
          file: null,
        };
      } else {
        next = createEmptyDraft();
      }
      setForm(next);
      setInitialForm(next);
      setErrors({});
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [opened, invoice]);

  useBeforeUnloadGuard(opened && isDirty);

  const handleConfirm = () => {
    const fieldErrors = validateDraftFields(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSave(form);
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const requestClose = () => {
    if (isDirty) {
      setConfirmCloseOpen(true);
      return;
    }
    handleClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={requestClose}
      title={isEditMode ? 'Редактирование счёта' : 'Добавление нового счёта'}
      size="lg"
    >
      <Stack gap="md" onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleConfirm();
        }
      }}>
        <Autocomplete
          label="Контрагент"
          placeholder="Введите имя контрагента"
          value={form.counterparty}
          onChange={(v) => {
            setForm((prev) => ({ ...prev, counterparty: v }));
            setErrors((prev) => ({ ...prev, counterparty: undefined }));
          }}
          data={counterpartyResults}
          searchable
          required
          error={errors.counterparty}
        />
        <Textarea
          label="Назначение платежа"
          placeholder="Введите назначение платежа"
          autosize
          value={form.purpose}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setForm((prev) => ({ ...prev, purpose: value }));
            setErrors((prev) => ({ ...prev, purpose: undefined }));
          }}
          required
          error={errors.purpose}
        />
        <TextInput
          label="Договор"
          placeholder="Номер договора"
          value={form.contract_no}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setForm((prev) => ({ ...prev, contract_no: value }));
          }}
        />
        <TextInput
          label="Номер счёта"
          placeholder="Введите номер счёта"
          value={form.invoice_no}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setForm((prev) => ({ ...prev, invoice_no: value }));
            setErrors((prev) => ({ ...prev, invoice_no: undefined }));
          }}
          required
          error={errors.invoice_no}
        />
        <NumberInput
          label="Сумма"
          placeholder="0"
          value={form.amount}
          onChange={(v) => {
            setForm((prev) => ({ ...prev, amount: v ?? 0 }));
            setErrors((prev) => ({ ...prev, amount: undefined }));
          }}
          thousandSeparator=" "
          decimalSeparator=","
          min={0}
          required
          error={errors.amount}
        />
        <TextInput
          label="Комментарий"
          placeholder="Введите комментарий"
          value={form.comment ?? ''}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setForm((prev) => ({ ...prev, comment: value }));
          }}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={requestClose}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} loading={loading}>
            {isEditMode ? 'Сохранить' : 'Добавить'}
          </Button>
        </Group>
      </Stack>
      <ConfirmModal
        opened={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          handleClose();
        }}
        title="Несохранённые изменения"
        message="Закрыть без сохранения? Введённые данные будут потеряны."
        confirmLabel="Закрыть без сохранения"
      />
    </Modal>
  );
}
