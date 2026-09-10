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
import { shortenFileName } from '@/shared/utils/shorten-file-name';
import { getEffectiveAmount } from '@/shared/utils/invoice-utils';
import { groupInvoicesByCounterparty, getInvoiceNumber } from '@/shared/utils/group-invoices';
import { getInvoiceFileUrl } from '@/api/collections';
import { useUserMap } from '@/shared/hooks/useUserMap';
import { useAutoScrollIntoView } from '@/shared/hooks/useAutoScrollIntoView';
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
  allInvoices?: IInvoice[];
  counterpartyOrder?: string[];
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
  onMarkForApproval?: (invoice: IInvoice) => void;
  onClearPaymentMark?: (markId: string) => void;
  onOpenPayModal: (invoice: IInvoice) => void;
  onClearPaymentConfirm: (invoiceId: string) => void;
  onOpenPartialModal: (invoice: IInvoice) => void;
}

export function InvoiceMobileCardView({
  invoices,
  allInvoices,
  counterpartyOrder,
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
  onMarkForApproval,
  onOpenPayModal,
  onClearPaymentConfirm,
  onOpenPartialModal,
}: InvoiceMobileCardViewProps) {
  const userMap = useUserMap();
  const groups = groupInvoicesByCounterparty(invoices, allInvoices, counterpartyOrder);
  const [draftErrors, setDraftErrors] = useState<DraftFieldErrors>({});
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const draftCardRef = useAutoScrollIntoView<HTMLDivElement>({
    enabled: isDraftOpen && !!draftForm,
  });

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
        const groupTotal = group.invoices.reduce((sum, inv) => sum + getEffectiveAmount(inv), 0);
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
              const hasRemainder = !invoice.paid && totalPaid > 0 && invoice.amount - totalPaid > 0;
              const invoiceFiles = filesByInvoice?.[invoice.id];

              return (
                <Paper
                  key={invoice.id}
                  withBorder
                  radius="sm"
                  p="xs"
                  mb="sm"
                  style={{
                    backgroundColor: invoice.paid
                      ? 'var(--mantine-color-yellow-1)'
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
                        {formatAmountRub(getEffectiveAmount(invoice))}
                      </Text>
                    </Group>
                    {invoice.paid ? (
                      <Badge color="green" variant="light" size="sm">
                        {formatAmountRub(invoice.paid_amount ?? invoice.amount)}
                      </Badge>
                    ) : amounts.length > 0 ? (
                      <Tooltip label="Снять оплату">
                        <Badge
                          color="green"
                          variant="light"
                          size="sm"
                          aria-label="Снять оплату"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            if (amounts.length === 1) {
                              onClearPaymentConfirm(invoice.id);
                            }
                          }}
                        >
                          {formatAmountRub(amounts[0]!)}
                        </Badge>
                      </Tooltip>
                    ) : (
                      <Tooltip label="Отметить оплату">
                        <Badge
                          color="orange"
                          variant="light"
                          size="sm"
                          aria-label="Отметить оплату"
                          style={{ cursor: 'pointer' }}
                          onClick={() => onOpenPayModal(invoice)}
                        >
                          Не оплачен
                        </Badge>
                      </Tooltip>
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
                    {invoice.created_by && (
                      <Text size="xs" c="dimmed">
                        Инициатор: {userMap.get(invoice.created_by)?.name ?? '—'}
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
                      <Text component="span" fw={700}>
                        Остаток:
                      </Text>{' '}
                      {formatAmountRub(invoice.amount - totalPaid)}
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
                        onMarkForApproval={onMarkForApproval}
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
        <Paper
          ref={draftCardRef}
          withBorder
          p="sm"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)',
            borderColor: 'var(--org-color, #228be6)',
            boxShadow:
              'inset 0 0 0 1px color-mix(in srgb, var(--org-color, #228be6) 40%, transparent)',
            animation: 'draft-pulse 1.4s ease-out 1',
          }}
        >
          <Badge
            size="sm"
            variant="light"
            mb="xs"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)',
              color: 'var(--org-color, #228be6)',
            }}
          >
            Новый счёт
          </Badge>
          <Stack gap="xs">
            <Autocomplete
              size="sm"
              value={draftForm?.counterparty ?? ''}
              onChange={(v) => handleDraftChange('counterparty', v)}
              onKeyDown={handleDraftKeyDown}
              data={counterpartyResults || []}
              placeholder="Контрагент"
              error={draftErrors.counterparty}
            />
            <TextInput
              size="sm"
              value={draftForm?.purpose ?? ''}
              onChange={(e) => handleDraftChange('purpose', e.currentTarget.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Назначение"
              error={draftErrors.purpose}
            />
            <TextInput
              size="sm"
              value={draftForm?.contract_no ?? ''}
              onChange={(e) => handleDraftChange('contract_no', e.currentTarget.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Договор"
            />
            <TextInput
              size="sm"
              value={draftForm?.invoice_no ?? ''}
              onChange={(e) => handleDraftChange('invoice_no', e.currentTarget.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Счёт"
              error={draftErrors.invoice_no}
            />
            <NumberInput
              size="sm"
              value={draftForm?.amount ?? 0}
              onChange={(v) => handleDraftChange('amount', v ?? 0)}
              onKeyDown={handleDraftKeyDown}
              thousandSeparator=" "
              decimalSeparator=","
              placeholder="Сумма"
              error={draftErrors.amount}
            />
            <TextInput
              size="sm"
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
