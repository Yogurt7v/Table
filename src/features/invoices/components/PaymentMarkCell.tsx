import { Group, Box, Text, Tooltip, ActionIcon, Checkbox, Button } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { IInvoice, IPaymentMark } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { paymentMarkLabel, APPROVAL_MARK_STATUS } from '../payment-mark-status';

interface PaymentMarkCellProps {
  invoice: IInvoice;
  mark: IPaymentMark | undefined;
  canMarkPayment: boolean;
  canViewPaymentMarks: boolean;
  canRemoveApprovalMark?: boolean;
  onMarkForPayment?: (invoice: IInvoice) => void;
  onMarkForApproval?: (invoice: IInvoice) => void;
  onOpenPartialModal?: (invoice: IInvoice) => void;
  onClearPaymentMark?: (markId: string) => void;
}

export function PaymentMarkCell({
  invoice,
  mark,
  canMarkPayment,
  canViewPaymentMarks,
  canRemoveApprovalMark = false,
  onMarkForPayment,
  onMarkForApproval,
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
                  {paymentMarkLabel(mark, invoice.amount)}: {mark.comment}
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
              {paymentMarkLabel(mark, invoice.amount)}: {formatAmountRub(mark.amount)}
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
        <Button size="xs" variant="subtle" onClick={() => onMarkForApproval?.(invoice)}>
          Согласование
        </Button>
      </Group>
    );
  }

  if (canViewPaymentMarks && mark) {
    const canRemove = canRemoveApprovalMark && mark.status === APPROVAL_MARK_STATUS;
    const removeIcon = canRemove && (
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
    );

    if (mark.amount == null || mark.amount === 0) {
      if (mark.comment) {
        return (
          <Group gap={4} wrap="nowrap">
            <Text size="xs" fw={600}>
              {paymentMarkLabel(mark, invoice.amount)}: {mark.comment}
            </Text>
            {removeIcon}
          </Group>
        );
      }
      return (
        <Group gap={4} wrap="nowrap">
          <Text size="xs" fw={600}>
            {formatAmountRub(invoice.amount)}
          </Text>
          {removeIcon}
        </Group>
      );
    }
    return (
      <Group gap={4} wrap="nowrap">
        <Box style={{ fontSize: 12, lineHeight: 1.3 }}>
          <Text size="xs" fw={600}>
            {paymentMarkLabel(mark, invoice.amount)}: {formatAmountRub(mark.amount)}
          </Text>
          {mark.comment && (
            <Text size="xs" c="dimmed">
              {mark.comment}
            </Text>
          )}
        </Box>
        {removeIcon}
      </Group>
    );
  }

  return (
    <Text size="xs" c="dimmed">
      —
    </Text>
  );
}
