import { Stack, Text } from '@mantine/core';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { IInvoice } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';

interface InvoiceTableDuplicateConfirmProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  duplicateInvoices: IInvoice[];
  pendingDuplicateForm: { counterparty: string; invoice_no: string; amount: number } | null;
}

export function InvoiceTableDuplicateConfirm({
  opened,
  onClose,
  onConfirm,
  duplicateInvoices,
}: InvoiceTableDuplicateConfirmProps) {
  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
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
  );
}
