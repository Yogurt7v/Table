import { Modal, Stack, Group, Text, NumberInput, Textarea, Button } from '@mantine/core';
import type { IInvoice } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';

interface PartialPaymentModalState {
  invoice: IInvoice;
  amount: string;
  comment: string;
}

interface PartialPaymentModalProps {
  opened: boolean;
  onClose: () => void;
  data: PartialPaymentModalState | null;
  onAmountChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onSave: (invoiceId: string, amount: number | undefined, comment: string) => void;
}

export function PartialPaymentModal({
  opened,
  onClose,
  data,
  onAmountChange,
  onCommentChange,
  onSave,
}: PartialPaymentModalProps) {
  if (!data) return null;

  const parsedAmount = Number(data.amount);
  const hasAmount = parsedAmount > 0;
  const hasComment = data.comment.trim().length > 0;
  const canSubmit = hasAmount || hasComment;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (hasAmount) {
      const amount = Math.min(parsedAmount, data.invoice.amount);
      onSave(data.invoice.id, amount, data.comment);
    } else {
      onSave(data.invoice.id, undefined, data.comment);
    }
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Частичная оплата" size="sm">
      <Stack
        gap="sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <Group gap={4}>
          <Text size="sm" fw={600}>Контрагент:</Text>
          <Text size="sm">{data.invoice.counterparty}</Text>
        </Group>
        <Group gap={4}>
          <Text size="sm" fw={600}>Назначение:</Text>
          <Text size="sm">{data.invoice.purpose}</Text>
        </Group>
        <Group gap={4}>
          <Text size="sm" fw={600}>Номер счёта:</Text>
          <Text size="sm">{data.invoice.invoice_no}</Text>
        </Group>
        <Group gap={4}>
          <Text size="sm" fw={600}>Дата:</Text>
          <Text size="sm">{data.invoice.date}</Text>
        </Group>
        <Group gap={4}>
          <Text size="sm" fw={600}>Договор:</Text>
          <Text size="sm">{data.invoice.contract_no}</Text>
        </Group>
        <Group gap={4}>
          <Text size="sm" fw={600}>Сумма счёта:</Text>
          <Text size="sm">{formatAmountRub(data.invoice.amount)}</Text>
        </Group>
        {data.invoice.comment && (
          <Group gap={4}>
            <Text size="sm" fw={600}>Комментарий:</Text>
            <Text size="sm">{data.invoice.comment}</Text>
          </Group>
        )}
        <NumberInput
          label="Сумма к оплате"
          value={data.amount}
          onChange={(v) => onAmountChange(String(v ?? ''))}
          thousandSeparator=" "
          decimalSeparator=","
          min={0}
          max={data.invoice.amount}
          clampBehavior="strict"
        />
        <Textarea
          label="Комментарий к оплате"
          value={data.comment}
          onChange={(e) => onCommentChange(e.currentTarget.value)}
          placeholder="Опционально"
          autosize
          minRows={2}
          maxRows={5}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button color="green" onClick={handleSubmit} disabled={!canSubmit}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export type { PartialPaymentModalState };
