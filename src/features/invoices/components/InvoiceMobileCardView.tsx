import dayjs from 'dayjs';
import {
  Stack,
  Paper,
  Text,
  Group,
  Badge,
  Anchor,
  Box,
  Autocomplete,
  TextInput,
  NumberInput,
  Button,
  FileInput,
} from '@mantine/core';
import type { IInvoice, IInvoiceFile, IPaymentMark } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { groupInvoicesByCounterparty, getInvoiceNumber } from '@/shared/utils/group-invoices';
import { getInvoiceFileUrl } from '@/api/collections';
import { PaymentMarkCell } from './PaymentMarkCell';
import { InvoiceActionsCell } from './InvoiceActionsCell';
import type { DraftInvoiceForm } from '../invoice-field-access';

interface Permissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canViewHistory: boolean;
  canMove: boolean;
  canMarkPayment: boolean;
  canViewPaymentMarks: boolean;
  canViewPaidDate: boolean;
  canManageFiles: boolean;
}

interface InvoiceMobileCardViewProps {
  invoices: IInvoice[];
  marksByInvoice: Record<string, IPaymentMark>;
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  highlightedIds: string[];
  permissions: Permissions;
  isDraftOpen: boolean;
  draftForm?: DraftInvoiceForm;
  counterpartyResults?: string[];
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onDraftSave?: () => void;
  onDraftCancel?: () => void;
  onEdit: (invoice: IInvoice) => void;
  onHistory: (invoice: IInvoice) => void;
  onMove: (invoice: IInvoice) => void;
  onFiles?: (invoice: IInvoice) => void;
  onCopy?: (invoice: IInvoice) => void;
  onDelete: (invoice: IInvoice) => void;
  onMarkForPayment?: (invoice: IInvoice) => void;
  onClearPaymentMark?: (markId: string) => void;
  onOpenPayModal: (invoice: IInvoice) => void;
  onClearPaymentConfirm: (invoiceId: string) => void;
  onOpenPartialModal: (invoice: IInvoice) => void;
}

function shortenFileName(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) {
    return name.length > 20 ? name.slice(0, 20) + '…' : name;
  }
  const base = name.slice(0, dotIndex);
  const ext = name.slice(dotIndex);
  return base.length > 16 ? base.slice(0, 16) + '…' + ext : name;
}

export function InvoiceMobileCardView({
  invoices,
  marksByInvoice,
  filesByInvoice,
  highlightedIds,
  permissions,
  isDraftOpen,
  draftForm,
  counterpartyResults,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onEdit,
  onHistory,
  onMove,
  onFiles,
  onCopy,
  onDelete,
  onClearPaymentMark,
  onMarkForPayment,
  onOpenPayModal,
  onClearPaymentConfirm,
  onOpenPartialModal,
}: InvoiceMobileCardViewProps) {
  const groups = groupInvoicesByCounterparty(invoices);

  return (
    <Stack hiddenFrom="sm" gap="md">
      {groups.map((group) => {
        const groupTotal = group.invoices.reduce((sum, inv) => sum + inv.amount, 0);
        return (
          <Paper
            key={group.counterparty}
            withBorder
            p="sm"
            style={{ borderLeft: '3px solid var(--org-color, #228be6)' }}
          >
            <Text fw={700} size="md" mb="xs">
              {group.counterparty}
            </Text>

            {group.invoices.map((invoice) => {
              const invoiceNumber = getInvoiceNumber(groups, invoice.id);
              const amounts = invoice.payment_amounts ?? [];
              const totalPaid = amounts.reduce((s, a) => s + a, 0);
              const hasRemainder = totalPaid > 0 && invoice.amount - totalPaid > 0;
              const invoiceFiles = filesByInvoice?.[invoice.id];

              return (
                <Paper
                  key={invoice.id}
                  withBorder
                  p="xs"
                  mb="sm"
                  style={{
                    backgroundColor: invoice.paid
                      ? 'var(--mantine-color-yellow-0)'
                      : marksByInvoice[invoice.id]
                        ? 'var(--mantine-color-green-0)'
                        : highlightedIds.includes(invoice.id)
                          ? 'var(--mantine-color-yellow-0)'
                          : undefined,
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" gap={4}>
                    <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" c="dimmed">
                        {invoiceNumber})
                      </Text>
                      <Text size="sm" fw={700}>
                        {formatAmountRub(invoice.amount)}
                      </Text>
                    </Group>
                    {invoice.paid ? (
                      <Badge color="green" variant="light" size="sm">
                        {formatAmountRub(invoice.paid_amount ?? invoice.amount)}
                      </Badge>
                    ) : amounts.length > 0 ? (
                      <Badge
                        color="green"
                        variant="light"
                        size="sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (amounts.length === 1) {
                            onClearPaymentConfirm(invoice.id);
                          }
                        }}
                      >
                        {formatAmountRub(amounts[0]!)}
                      </Badge>
                    ) : (
                      <Badge
                        color="orange"
                        variant="light"
                        size="sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() => onOpenPayModal(invoice)}
                      >
                        Не оплачен
                      </Badge>
                    )}
                  </Group>

                  {invoice.purpose && (
                    <Text size="md" lineClamp={2} mt={2}>
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

                  {invoiceFiles && invoiceFiles.length > 0 && (
                    <Stack gap={2} mt={2}>
                      {invoiceFiles.map((f) => (
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
                    <Text size="xs" c="orange" mt={2}>
                      Остаток: {formatAmountRub(invoice.amount - totalPaid)}
                    </Text>
                  )}

                  <Group justify="space-between" mt={4} wrap="nowrap">
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <PaymentMarkCell
                        invoice={invoice}
                        mark={marksByInvoice[invoice.id]}
                        canMarkPayment={permissions.canMarkPayment}
                        canViewPaymentMarks={permissions.canViewPaymentMarks}
                        onMarkForPayment={onMarkForPayment}
                        onOpenPartialModal={onOpenPartialModal}
                        onClearPaymentMark={onClearPaymentMark}
                      />
                    </Box>
                    <InvoiceActionsCell
                      invoice={invoice}
                      canUpdate={permissions.canUpdate}
                      canDelete={permissions.canDelete}
                      canViewHistory={permissions.canViewHistory}
                      canMove={permissions.canMove}
                      canCreate={permissions.canCreate}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onHistory={onHistory}
                      onMove={onMove}
                      onFiles={onFiles}
                      onCopy={onCopy}
                      compact
                    />
                  </Group>
                </Paper>
              );
            })}

            <Text ta="right" fw={700} size="sm" mt="xs">
              Итого: {formatAmountRub(groupTotal)}
            </Text>
          </Paper>
        );
      })}

      {isDraftOpen && draftForm && (
        <Paper withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
          <Text fw={600} size="sm" mb="xs">
            Новый счёт
          </Text>
          <Stack gap="xs">
            <Autocomplete
              size="xs"
              value={draftForm?.counterparty ?? ''}
              onChange={(v) => onDraftChange?.('counterparty', v)}
              data={counterpartyResults || []}
              placeholder="Контрагент"
            />
            <TextInput
              size="xs"
              value={draftForm?.purpose ?? ''}
              onChange={(e) => onDraftChange?.('purpose', e.currentTarget.value)}
              placeholder="Назначение"
            />
            <TextInput
              size="xs"
              value={draftForm?.contract_no ?? ''}
              onChange={(e) => onDraftChange?.('contract_no', e.currentTarget.value)}
              placeholder="Договор"
            />
            <TextInput
              size="xs"
              value={draftForm?.invoice_no ?? ''}
              onChange={(e) => onDraftChange?.('invoice_no', e.currentTarget.value)}
              placeholder="Счёт"
            />
            <NumberInput
              size="xs"
              value={draftForm?.amount ?? 0}
              onChange={(v) => onDraftChange?.('amount', v ?? 0)}
              thousandSeparator=" "
              decimalSeparator=","
              placeholder="Сумма"
            />
            <TextInput
              size="xs"
              value={draftForm?.comment ?? ''}
              onChange={(e) => onDraftChange?.('comment', e.currentTarget.value)}
              placeholder="Комментарий"
            />
            <FileInput
              size="xs"
              placeholder="Файл"
              value={draftForm?.file ?? null}
              onChange={(v) => onDraftChange?.('file', v)}
              clearable
            />
            <Group justify="flex-end" gap={4} mt="xs">
              <Button size="compact-sm" variant="default" onClick={onDraftCancel}>
                Отмена
              </Button>
              <Button size="compact-sm" color="green" onClick={onDraftSave}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
