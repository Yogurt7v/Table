import { Group, Box, Text, Tooltip, ActionIcon, Checkbox, Button } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { IInvoice, IPaymentMark } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';

interface PaymentMarkCellProps {
  invoice: IInvoice;
  mark: IPaymentMark | undefined;
  canMarkPayment: boolean;
  canViewPaymentMarks: boolean;
  onMarkForPayment?: (invoice: IInvoice) => void;
  onOpenPartialModal?: (invoice: IInvoice) => void;
  onClearPaymentMark?: (markId: string) => void;
}

export function PaymentMarkCell({
  invoice,
  mark,
  canMarkPayment,
  canViewPaymentMarks,
  onMarkForPayment,
  onOpenPartialModal,
  onClearPaymentMark,
}: PaymentMarkCellProps) {
  if (canMarkPayment) {
    if (mark) {
      if (mark.amount == null || mark.amount === 0) {
        if (mark.comment) {
          return (
            <Group gap={4} wrap="nowrap">
              <Box style={{ fontSize: 12, lineHeight: 1.3 }}>
                <Text size="xs" fw={600}>
                  Оплатить: {mark.comment}
                </Text>
              </Box>
              <Tooltip label="Убрать отметку">
                <ActionIcon
                  size="sm"
                  color="red"
                  variant="subtle"
                  aria-label="Убрать отметку"
                  onClick={() => onClearPaymentMark?.(mark.id)}
                >
                  <IconX size={12} />
                </ActionIcon>
              </Tooltip>
            </Group>
          );
        }
        return (
          <Checkbox
            size="xs"
            label={formatAmountRub(invoice.amount)}
            checked
            onChange={() => onClearPaymentMark?.(mark.id)}
          />
        );
      }
      return (
        <Group gap={4} wrap="nowrap">
          <Box style={{ fontSize: 12, lineHeight: 1.3 }}>
            <Text size="xs" fw={600}>
              Оплатить: {formatAmountRub(mark.amount)}
            </Text>
            {mark.comment && (
              <Tooltip label={mark.comment}>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {mark.comment}
                </Text>
              </Tooltip>
            )}
          </Box>
          <Tooltip label="Убрать отметку">
            <ActionIcon
              size="sm"
              color="red"
              variant="subtle"
              aria-label="Убрать отметку"
              onClick={() => onClearPaymentMark?.(mark.id)}
            >
              <IconX size={12} />
            </ActionIcon>
          </Tooltip>
        </Group>
      );
    }

    if (invoice.paid) {
      return (
        <Text size="xs" c="dimmed">Уже оплачено</Text>
      );
    }

    return (
      <Group gap={4} wrap="nowrap">
        <Button size="xs" onClick={() => onMarkForPayment?.(invoice)}>
          Оплатить
        </Button>
        <Button
          size="xs"
          variant="light"
          onClick={() => onOpenPartialModal?.(invoice)}
        >
          Частично
        </Button>
      </Group>
    );
  }

  if (canViewPaymentMarks && mark) {
    if (mark.amount == null || mark.amount === 0) {
      if (mark.comment) {
        return (
          <Text size="xs" fw={600}>
            Оплатить: {mark.comment}
          </Text>
        );
      }
      return (
        <Text size="xs" fw={600}>
          {formatAmountRub(invoice.amount)}
        </Text>
      );
    }
    return (
      <Box style={{ fontSize: 12, lineHeight: 1.3 }}>
        <Text size="xs" fw={600}>
          {formatAmountRub(mark.amount)}
        </Text>
        {mark.comment && (
          <Text size="xs" c="dimmed">
            {mark.comment}
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Text size="xs" c="dimmed">
      —
    </Text>
  );
}
