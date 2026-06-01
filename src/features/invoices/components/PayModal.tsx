import { Modal, Stack, Group, Text, NumberInput, Button } from '@mantine/core';
import type { IInvoice } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';

interface PayModalProps {
  opened: boolean;
  onClose: () => void;
  invoice: IInvoice | null;
  amount: string;
  onAmountChange: (value: string) => void;
  onPay: (invoice: IInvoice, amount: number) => void;
}

export function PayModal({ opened, onClose, invoice, amount, onAmountChange, onPay }: PayModalProps) {
  if (!invoice) return null;

  const parsedAmount = Math.min(Number(amount), invoice.amount);
  const isValid = parsedAmount > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onPay(invoice, parsedAmount);
    onAmountChange('');
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Оплата счёта" size="sm">
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
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button color="green" onClick={handleSubmit} disabled={!isValid}>
            Оплатить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
