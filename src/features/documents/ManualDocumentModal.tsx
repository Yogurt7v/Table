import { useMemo, useState } from 'react';
import {
  Button,
  Grid,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useCreateManualDocument, useOrgInvoices } from '@/shared/hooks/useDocuments';
import { dateKeyToLocalDate, localDateToDateKey, todayDateKey } from '@/features/mail/mail-date';
import { formatAmountRub } from '@/shared/utils/format-currency';
import type { IAccountingObject, IInvoice, IUser } from '@/shared/types';
import type { OrgRole } from '@/features/invoices/invoice-field-access';

interface ManualDocumentModalProps {
  opened: boolean;
  onClose: () => void;
  organizationId: string;
  role: OrgRole;
  currentUserId: string | undefined;
  objects: IAccountingObject[];
  users: IUser[];
}

interface FormState {
  accountingObjectId: string;
  paymentDate: string;
  counterparty: string;
  purpose: string;
  contractNo: string;
  invoiceNo: string;
  amount: number;
  responsibleId: string;
  sourceInvoiceId: string;
}

function initialForm(currentUserId: string | undefined): FormState {
  return {
    accountingObjectId: '',
    paymentDate: todayDateKey(),
    counterparty: '',
    purpose: '',
    contractNo: '',
    invoiceNo: '',
    amount: 0,
    responsibleId: currentUserId ?? '',
    sourceInvoiceId: '',
  };
}

export function ManualDocumentModal({
  opened,
  onClose,
  organizationId,
  role,
  currentUserId,
  objects,
  users,
}: ManualDocumentModalProps) {
  const createDocument = useCreateManualDocument(organizationId);
  const invoicesQuery = useOrgInvoices(opened ? organizationId : '');
  const [form, setForm] = useState<FormState>(() => initialForm(currentUserId));

  const canChooseResponsible = role === 'admin' || role === 'moderator';

  const userOptions = useMemo(
    () => users.map((user) => ({ value: user.id, label: user.name || user.login || user.email })),
    [users],
  );
  const objectOptions = useMemo(
    () => objects.map((object) => ({ value: object.id, label: object.name })),
    [objects],
  );
  const invoiceOptions = useMemo(
    () =>
      (invoicesQuery.data ?? []).map((invoice) => ({
        value: invoice.id,
        label: `№${invoice.invoice_no || '—'} · ${invoice.counterparty} · ${formatAmountRub(invoice.amount)}`,
      })),
    [invoicesQuery.data],
  );

  const patch = (value: Partial<FormState>) => setForm((current) => ({ ...current, ...value }));

  const applyInvoice = (invoice: IInvoice) => {
    patch({
      sourceInvoiceId: invoice.id,
      counterparty: invoice.counterparty,
      purpose: invoice.purpose,
      contractNo: invoice.contract_no,
      invoiceNo: invoice.invoice_no,
      amount: invoice.amount,
      paymentDate: invoice.paid_date || invoice.date || todayDateKey(),
      accountingObjectId: invoice.accounting_object_id,
      responsibleId: canChooseResponsible ? form.responsibleId : invoice.created_by,
    });
  };

  const handleInvoiceChange = (invoiceId: string | null) => {
    if (!invoiceId) {
      patch({ sourceInvoiceId: '' });
      return;
    }
    const invoice = invoicesQuery.data?.find((item) => item.id === invoiceId);
    if (invoice) applyInvoice(invoice);
  };

  const handleSubmit = async () => {
    try {
      await createDocument.mutateAsync({
        organizationId,
        accountingObjectId: form.accountingObjectId,
        paymentDate: form.paymentDate,
        counterparty: form.counterparty,
        purpose: form.purpose,
        contractNo: form.contractNo,
        invoiceNo: form.invoiceNo,
        amount: form.amount,
        responsibleId: form.responsibleId,
        responsibleName:
          users.find((user) => user.id === form.responsibleId)?.name ||
          users.find((user) => user.id === form.responsibleId)?.login ||
          '',
        sourceInvoiceId: form.sourceInvoiceId || undefined,
        sourceInvoiceNo: form.sourceInvoiceId
          ? invoicesQuery.data?.find((invoice) => invoice.id === form.sourceInvoiceId)?.invoice_no
          : undefined,
      });
      notifications.show({ color: 'green', message: 'Документ создан' });
      onClose();
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось создать документ' });
    }
  };

  const canSubmit =
    !!form.accountingObjectId &&
    !!form.paymentDate &&
    !!form.counterparty.trim() &&
    !!form.responsibleId &&
    !createDocument.isPending;

  return (
    <Modal opened={opened} onClose={onClose} title="Новый документ" size="lg">
      <Stack gap="md">
        <Select
          label="Связанный счёт"
          description="Необязательно. При выборе данные счёта заполнятся автоматически."
          data={invoiceOptions}
          value={form.sourceInvoiceId || null}
          onChange={handleInvoiceChange}
          searchable
          clearable
          nothingFoundMessage="Счета не найдены"
          disabled={invoicesQuery.isLoading}
        />

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Объект"
              data={objectOptions}
              value={form.accountingObjectId || null}
              onChange={(value) => patch({ accountingObjectId: value ?? '' })}
              required
              searchable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DatePickerInput
              label="Дата оплаты"
              valueFormat="DD.MM.YYYY"
              value={dateKeyToLocalDate(form.paymentDate)}
              onChange={(value) => patch({ paymentDate: localDateToDateKey(value) })}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Контрагент"
              value={form.counterparty}
              onChange={(event) => patch({ counterparty: event.currentTarget.value })}
              required
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <TextInput
              label="Договор"
              value={form.contractNo}
              onChange={(event) => patch({ contractNo: event.currentTarget.value })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <TextInput
              label="Счёт №"
              value={form.invoiceNo}
              onChange={(event) => patch({ invoiceNo: event.currentTarget.value })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <NumberInput
              label="Сумма"
              value={form.amount}
              onChange={(value) => patch({ amount: typeof value === 'number' ? value : 0 })}
              min={0}
              decimalScale={2}
              thousandSeparator=" "
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Ответственный"
              data={userOptions}
              value={form.responsibleId || null}
              onChange={(value) => patch({ responsibleId: value ?? '' })}
              required
              searchable
              disabled={!canChooseResponsible}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              label="Назначение"
              value={form.purpose}
              onChange={(event) => patch({ purpose: event.currentTarget.value })}
              autosize
              minRows={2}
              maxRows={5}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} loading={createDocument.isPending} disabled={!canSubmit}>
            Создать документ
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
