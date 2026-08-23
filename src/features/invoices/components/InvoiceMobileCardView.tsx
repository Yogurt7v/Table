import { useState, type KeyboardEvent } from 'react';
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
  FileButton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconPaperclip } from '@tabler/icons-react';
import type { IInvoice, IInvoiceFile, IPaymentMark } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { groupInvoicesByCounterparty, getInvoiceNumber } from '@/shared/utils/group-invoices';
import { getInvoiceFileUrl } from '@/api/collections';
import { PaymentMarkCell } from './PaymentMarkCell';
import { InvoiceActionsCell } from './InvoiceActionsCell';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type {
  DraftFieldErrorKey,
  DraftFieldErrors,
  DraftInvoiceForm,
} from '../invoice-field-access';
import { isDraftDirty, validateDraftFields } from '../invoice-field-access';

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
  const [draftErrors, setDraftErrors] = useState<DraftFieldErrors>({});
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const requestDraftCancel = () => {
    if (draftForm && isDraftDirty(draftForm)) {
      setDiscardConfirmOpen(true);
      return;
    }
    setDraftErrors({});
    onDraftCancel?.();
  };

  const handleDraftSaveClick = () => {
    if (!draftForm) {
      onDraftSave?.();
      return;
    }
    const errors = validateDraftFields(draftForm);
    if (Object.keys(errors).length > 0) {
      setDraftErrors(errors);
      return;
    }
    setDraftErrors({});
    onDraftSave?.();
  };

  const handleDraftChange = (field: keyof DraftInvoiceForm, value: unknown) => {
    setDraftErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as DraftFieldErrorKey];
      return next;
    });
    onDraftChange?.(field, value);
  };

  const handleDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (e.currentTarget.getAttribute('aria-expanded') === 'true') return;
    e.preventDefault();
    handleDraftSaveClick();
  };

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
                          ? 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)'
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
                    <Text mt={2}>
                      <Text component="span" fw={700}>Остаток:</Text> {formatAmountRub(invoice.amount - totalPaid)}
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
                    <Group gap={2} wrap="nowrap">
                      {onFiles && (
                        <Tooltip
                          label={
                            invoiceFiles?.length
                              ? `Файлы счёта (${invoiceFiles.length})`
                              : 'Прикрепить файл'
                          }
                        >
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Файлы счёта${invoiceFiles?.length ? ` (${invoiceFiles.length})` : ''}`}
                            onClick={() => onFiles(invoice)}
                          >
                            <IconPaperclip size={18} />
                          </ActionIcon>
                        </Tooltip>
                      )}
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
              onChange={(v) => handleDraftChange('counterparty', v)}
              onKeyDown={handleDraftKeyDown}
              data={counterpartyResults || []}
              placeholder="Контрагент"
              error={draftErrors.counterparty}
            />
            <TextInput
              size="xs"
              value={draftForm?.purpose ?? ''}
              onChange={(e) => handleDraftChange('purpose', e.currentTarget.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Назначение"
              error={draftErrors.purpose}
            />
            <TextInput
              size="xs"
              value={draftForm?.contract_no ?? ''}
              onChange={(e) => handleDraftChange('contract_no', e.currentTarget.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Договор"
            />
            <TextInput
              size="xs"
              value={draftForm?.invoice_no ?? ''}
              onChange={(e) => handleDraftChange('invoice_no', e.currentTarget.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Счёт"
              error={draftErrors.invoice_no}
            />
            <NumberInput
              size="xs"
              value={draftForm?.amount ?? 0}
              onChange={(v) => handleDraftChange('amount', v ?? 0)}
              onKeyDown={handleDraftKeyDown}
              thousandSeparator=" "
              decimalSeparator=","
              placeholder="Сумма"
              error={draftErrors.amount}
            />
            <TextInput
              size="xs"
              value={draftForm?.comment ?? ''}
              onChange={(e) => handleDraftChange('comment', e.currentTarget.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Комментарий"
            />
            <Group gap={4}>
              <FileButton onChange={(v) => onDraftChange?.('file', v)}>
                {(props) => (
                  <Tooltip label={draftForm?.file?.name ?? 'Прикрепить файл'}>
                    <ActionIcon
                      {...props}
                      variant={draftForm?.file ? 'light' : 'subtle'}
                      color={draftForm?.file ? 'blue' : 'gray'}
                      size="sm"
                    >
                      <IconPaperclip size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </FileButton>
              {draftForm?.file && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {draftForm.file.name}
                </Text>
              )}
            </Group>
            <Group justify="flex-end" gap={4} mt="xs">
              <Button size="compact-sm" variant="default" onClick={requestDraftCancel}>
                Отмена
              </Button>
              <Button size="compact-sm" color="green" onClick={handleDraftSaveClick}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}

      <ConfirmModal
        opened={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          setDraftErrors({});
          onDraftCancel?.();
        }}
        title="Несохранённый счёт"
        message="Отменить добавление счёта? Введённые данные будут потеряны."
        confirmLabel="Отменить без сохранения"
      />
    </Stack>
  );
}
