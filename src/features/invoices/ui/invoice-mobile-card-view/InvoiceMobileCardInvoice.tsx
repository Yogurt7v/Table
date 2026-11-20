import dayjs from 'dayjs';
import { ActionIcon, Anchor, Badge, Box, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { IconTrash, IconX } from '@tabler/icons-react';
import type { IInvoice, IInvoiceFile, IPaymentMark } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { shortenFileName } from '@/shared/utils/shorten-file-name';
import { getEffectiveAmount } from '@/shared/utils/invoice-utils';
import { getInvoiceFileUrl } from '@/api/collections';
import { PaymentMarkCell } from '@/features/invoices/ui/payment-mark-cell/PaymentMarkCell';
import { markRowColor } from '@/features/invoices/model/payment-mark-row-style';
import type { InvoiceMobileCardPermissions } from './invoice-mobile-card-view-types';

interface InvoiceMobileCardInvoiceProps {
  invoice: IInvoice;
  invoiceNumber: number;
  mark?: IPaymentMark;
  files?: IInvoiceFile[];
  isHighlighted: boolean;
  permissions: InvoiceMobileCardPermissions;
  onMarkForPayment?: (invoice: IInvoice) => void;
  onMarkForApproval?: (invoice: IInvoice) => void;
  onClearPaymentMark?: (markId: string) => void;
  onClearPaymentConfirm: (invoiceId: string) => void;
  onOpenPartialModal: (invoice: IInvoice) => void;
  onApproveMark?: (markId: string) => void;
  onDelete?: (invoice: IInvoice) => void;
}

/**
 * Карточка одного счёта в мобильном списке: сумма/статус оплаты, реквизиты,
 * файлы, остаток, отметка к оплате и (при праве) удаление.
 */
export function InvoiceMobileCardInvoice({
  invoice,
  invoiceNumber,
  mark,
  files,
  isHighlighted,
  permissions,
  onMarkForPayment,
  onMarkForApproval,
  onClearPaymentMark,
  onClearPaymentConfirm,
  onOpenPartialModal,
  onApproveMark,
  onDelete,
}: InvoiceMobileCardInvoiceProps) {
  const amounts = invoice.payment_amounts ?? [];
  const totalPaid = amounts.reduce((s, a) => s + a, 0);
  const hasRemainder = !invoice.paid && totalPaid > 0 && invoice.amount - totalPaid > 0;
  const showDelete = permissions.canDelete && !!onDelete;

  // Фон: оплачен — зелёный, есть отметка — цвет отметки, подсвечен — микс с цветом орг.
  const backgroundColor = invoice.paid
    ? 'var(--mantine-color-green-1)'
    : mark
      ? markRowColor(mark, invoice.amount)
      : isHighlighted
        ? 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)'
        : undefined;

  return (
    <Paper
      withBorder
      radius="sm"
      p="xs"
      mb="sm"
      data-highlight-id={isHighlighted ? invoice.id : undefined}
      style={{
        backgroundColor,
        ...(isHighlighted
          ? {
              boxShadow:
                'inset 4px 0 0 var(--org-color, #228be6), inset 0 0 0 2px color-mix(in srgb, var(--org-color, #228be6) 45%, transparent)',
            }
          : {}),
      }}
    >
      {/* Номер, сумма к показу и статус оплаты (полная/частичная/нет) */}
      <Group justify="space-between" wrap="nowrap" gap={4}>
        <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" c="dimmed">
            {invoiceNumber})
          </Text>
          <Text size="md" fw={800}>
            {formatAmountRub(getEffectiveAmount(invoice))}
          </Text>
        </Group>
        {invoice.paid ? (
          <Badge color="green" variant="light" size="sm">
            {formatAmountRub(invoice.paid_amount ?? invoice.amount)}
          </Badge>
        ) : amounts.length > 0 ? (
          <Group gap={4} wrap="nowrap">
            <Badge color="green" variant="light" size="sm">
              {formatAmountRub(amounts[0]!)}
            </Badge>
            {amounts.length === 1 && (
              <Tooltip label="Снять оплату">
                <ActionIcon
                  size="md"
                  color="red"
                  variant="filled"
                  aria-label="Снять оплату"
                  onClick={() => onClearPaymentConfirm(invoice.id)}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ) : (
          <Badge color="gray" variant="light" size="sm">
            Не оплачен
          </Badge>
        )}
      </Group>

      {invoice.purpose && (
        <Text size="md" fw={600} lineClamp={3} mt={2}>
          {invoice.purpose}
        </Text>
      )}

      <Group gap="xs" mt={2}>
        {invoice.contract_no && (
          <Text size="xs" c="dimmed">
            Договор: {invoice.contract_no}
          </Text>
        )}
        {invoice.invoice_no && (
          <Text size="xs" c="dimmed">
            Счёт: {invoice.invoice_no}
          </Text>
        )}
      </Group>

      {permissions.canViewPaidDate && invoice.paid_date && (
        <Text size="xs" c="dimmed">
          Оплачено: {dayjs(invoice.paid_date).format('DD.MM.YYYY')}
        </Text>
      )}

      {invoice.comment && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {invoice.comment}
        </Text>
      )}

      {files && files.length > 0 && (
        <Stack gap={2} mt={2}>
          {files.map((f) => (
            <Anchor
              key={f.id}
              href={getInvoiceFileUrl(f)}
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
            >
              {shortenFileName(f.name)}
            </Anchor>
          ))}
        </Stack>
      )}

      {hasRemainder && (
        <Text mt={2}>
          <Text component="span" fw={700}>
            Остаток:
          </Text>{' '}
          {formatAmountRub(invoice.amount - totalPaid)}
        </Text>
      )}

      {/* Отметка к оплате: действия зависят от прав и текущей отметки */}
      <Box mt={4}>
        <PaymentMarkCell
          invoice={invoice}
          mark={mark}
          canMarkPayment={permissions.canMarkPayment}
          canViewPaymentMarks={permissions.canViewPaymentMarks}
          canRemoveApprovalMark={permissions.canRemoveApprovalMark}
          onMarkForPayment={onMarkForPayment}
          onMarkForApproval={onMarkForApproval}
          onOpenPartialModal={onOpenPartialModal}
          onClearPaymentMark={onClearPaymentMark}
          onApproveMark={onApproveMark}
        />
      </Box>

      {showDelete && (
        <Group justify="flex-end" mt={2}>
          <Tooltip label="Удалить счёт">
            <ActionIcon
              size="md"
              color="red"
              variant="subtle"
              aria-label="Удалить счёт"
              onClick={() => onDelete?.(invoice)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
    </Paper>
  );
}
