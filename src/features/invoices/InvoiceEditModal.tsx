import {
  Modal,
  Button,
  Stack,
  TextInput,
  NumberInput,
  Alert,
  Autocomplete,
  Group,
  Textarea,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import type { IInvoice } from '@/shared/types';
import type { DraftInvoiceForm } from './invoice-field-access';
import { createEmptyDraft, validateDraftForm } from './invoice-field-access';

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
  const [error, setError] = useState<string | null>(null);
  const isEditMode = !!invoice;

  useEffect(() => {
    if (opened) {
      if (invoice) {
        setForm({
          counterparty: invoice.counterparty,
          purpose: invoice.purpose,
          contract_no: invoice.contract_no,
          invoice_no: invoice.invoice_no,
          amount: invoice.amount || 0,
          paid: invoice.paid || false,
          paid_date: invoice.paid_date,
          comment: invoice.comment,
        });
      } else {
        setForm(createEmptyDraft());
      }
      setError(null);
    }
  }, [opened, invoice]);

  const handleConfirm = () => {
    const validationError = validateDraftForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSave(form);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={isEditMode ? 'Редактирование счёта' : 'Добавление нового счёта'}
      size="lg"
    >
      <Stack gap="md">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Ошибка">
            {error}
          </Alert>
        )}
        <Autocomplete
          label="Контрагент"
          placeholder="Введите имя контрагента"
          value={form.counterparty}
          onChange={(v) => setForm((prev) => ({ ...prev, counterparty: v }))}
          data={counterpartyResults}
          searchable
          required
        />
        <Textarea
          label="Назначение платежа"
          placeholder="Введите назначение платежа"
          autosize
          value={form.purpose}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setForm((prev) => ({ ...prev, purpose: value }));
          }}
          required
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
          }}
          required
        />
        <NumberInput
          label="Сумма"
          placeholder="0"
          value={form.amount}
          onChange={(v) => setForm((prev) => ({ ...prev, amount: v ?? 0 }))}
          thousandSeparator=" "
          decimalSeparator=","
          min={0}
          required
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
          <Button variant="default" onClick={handleClose}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} loading={loading}>
            {isEditMode ? 'Сохранить' : 'Добавить'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
