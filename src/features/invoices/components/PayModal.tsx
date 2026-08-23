import { Modal, Stack, Group, Text, NumberInput, Button } from '@mantine/core';
import { useState } from 'react';
import type { IInvoice } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { ConfirmModal } from '@/shared/components/ConfirmModal';

interface PayModalProps {
  opened: boolean;
  onClose: () => void;
  invoice: IInvoice | null;
  amount: string;
  onAmountChange: (value: string) => void;
  onPay: (invoice: IInvoice, amount: number) => void;
}

export function PayModal({ opened, onClose, invoice, amount, onAmountChange, onPay }: PayModalProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  if (!invoice) return null;

  const parsedAmount = Math.min(Number(amount), invoice.amount);
  const isValid = parsedAmount > 0;
  const isDirty = amount !== '' && Number(amount) !== invoice.amount;

  const handleClose = () => {
    onAmountChange('');
    onClose();
  };

  const requestClose = () => {
    if (isDirty) {
      setConfirmCloseOpen(true);
      return;
    }
    handleClose();
  };

  const handleSubmit = () => {
    if (!isValid) return;
    onPay(invoice, parsedAmount);
    handleClose();
  };

  return (
    <Modal opened={opened} onClose={requestClose} title="Оплата счёта" size="sm">
      <Stack
        gap="sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <Group gap={4}>
          <Text size="sm" fw={600}>Контрагент:</Text>
          <Text size="sm">{invoice.counterparty}</Text>
        </Group>
        <Group gap={4}>
          <Text size="sm" fw={600}>Назначение:</Text>
          <Text size="sm">{invoice.purpose}</Text>
        </Group>
        <Group gap={4}>
          <Text size="sm" fw={600}>Сумма счёта:</Text>
          <Text size="sm">{formatAmountRub(invoice.amount)}</Text>
        </Group>
        <NumberInput
          label="Сумма к оплате"
          value={amount}
          onChange={(v) => onAmountChange(String(v ?? ''))}
          thousandSeparator=" "
          decimalSeparator=","
          min={0}
          max={invoice.amount}
          clampBehavior="strict"
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={requestClose}>
            Отмена
          </Button>
          <Button color="green" onClick={handleSubmit} disabled={!isValid}>
            Оплатить
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
        message="Закрыть без сохранения? Введённая сумма будет потеряна."
        confirmLabel="Закрыть без сохранения"
      />
    </Modal>
  );
}
