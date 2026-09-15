import { Group, Box, Text, Tooltip, ActionIcon, Checkbox, Button } from '@mantine/core';
import { IconX, IconCheck } from '@tabler/icons-react';
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
  onApproveMark?: (markId: string) => void;
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
  onApproveMark,
}: PaymentMarkCellProps) {
  const renderClearMarkButton = (markId: string) => (
    <Tooltip label="Убрать отметку">
      <ActionIcon
        size="md"
        color="red"
        variant="filled"
        aria-label="Убрать отметку"
        onClick={() => onClearPaymentMark?.(markId)}
      >
        <IconX size={14} />
      </ActionIcon>
    </Tooltip>
  );

  const renderApproveMarkButton = (markId: string) => (
    <Tooltip label="Отметить к оплате">
      <ActionIcon
        size="md"
        color="green"
        variant="filled"
        aria-label="Отметить к оплате"
        onClick={() => onApproveMark?.(markId)}
      >
        <IconCheck size={14} />
      </ActionIcon>
    </Tooltip>
  );

  const canApprove = mark?.status === APPROVAL_MARK_STATUS;
  const approveIcon = canApprove && onApproveMark ? renderApproveMarkButton(mark.id) : null;

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
              {approveIcon}
              {renderClearMarkButton(mark.id)}
            </Group>
          );
        }
        return (
          <Group gap={4} wrap="nowrap">
            <Checkbox
              size="xs"
              label={formatAmountRub(invoice.amount)}
              checked
              onChange={() => onClearPaymentMark?.(mark.id)}
            />
            {approveIcon}
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
              <Tooltip label={mark.comment}>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {mark.comment}
                </Text>
              </Tooltip>
            )}
          </Box>
          {approveIcon}
          {renderClearMarkButton(mark.id)}
        </Group>
      );
    }

    if (invoice.paid) {
      return (
        <Text size="xs" c="dimmed">Уже оплачено</Text>
      );
    }

    return (
      <Group gap={4} wrap="nowrap" justify="space-evenly" top="20px">
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
        <Button size="xs" style={{border: "1px solid var(--mantine-color-blue-light-color)"}} variant="subtle" onClick={() => onMarkForApproval?.(invoice)}>
          Согласование
        </Button>
      </Group>
    );
  }

  if (canViewPaymentMarks && mark) {
    const canRemove = canRemoveApprovalMark && mark.status === APPROVAL_MARK_STATUS;
    const removeIcon = canRemove && renderClearMarkButton(mark.id);

    if (mark.amount == null || mark.amount === 0) {
      if (mark.comment) {
        return (
          <Group gap={4} wrap="nowrap">
            <Text size="xs" fw={600}>
              {paymentMarkLabel(mark, invoice.amount)}: {mark.comment}
            </Text>
            {approveIcon}
            {removeIcon}
          </Group>
        );
      }
      return (
        <Group gap={4} wrap="nowrap">
          <Text size="xs" fw={600}>
            {formatAmountRub(invoice.amount)}
          </Text>
          {approveIcon}
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
        {approveIcon}
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
