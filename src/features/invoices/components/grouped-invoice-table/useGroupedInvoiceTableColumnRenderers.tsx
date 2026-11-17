import dayjs from 'dayjs';
import type { Dispatch, SetStateAction } from 'react';
import {
  ActionIcon,
  Anchor,
  Autocomplete,
  Badge,
  Button,
  FileButton,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconPaperclip, IconX } from '@tabler/icons-react';

import type { IInvoice, IInvoiceFile, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import { getInvoiceFileUrl } from '@/api/collections';
import { formatAmountNumber, formatAmountRub } from '@/shared/utils/format-currency';
import { shortenFileName } from '@/shared/utils/shorten-file-name';
import { getEffectiveAmount } from '@/shared/utils/invoice-utils';
import { getInitiatorDisplayName } from '@/shared/utils/user-display-name';
import type { DraftFieldErrors, DraftInvoiceForm } from '@/features/invoices/invoice-field-access';
import { PaymentMarkCell } from '@/features/invoices/components/PaymentMarkCell';
import { InvoiceActionsCell } from '@/features/invoices/components/InvoiceActionsCell';

const DRAFT_INPUT_STYLE = {
  fontWeight: 600,
  fontSize: 13,
} as const;

export interface InvoiceColumnRenderer {
  width: number;
  header: string;
  renderCell: (invoice: IInvoice) => React.ReactNode;
  renderDraft: () => React.ReactNode;
}

/** Параметры хука рендереров колонок таблицы сгруппированных счетов. */
export interface UseGroupedInvoiceTableColumnRenderersParams {
  draftForm?: DraftInvoiceForm;
  draftErrors: DraftFieldErrors;
  amountFocused: boolean;
  amountDisplay: string;
  counterpartyResults?: string[];
  permissions: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canViewHistory: boolean;
    canMove: boolean;
    canPay: boolean;
    canMarkPayment: boolean;
    canRemoveApprovalMark: boolean;
    canViewPaymentMarks: boolean;
    canManageFiles: boolean;
  };
  marksByInvoice: Record<string, IPaymentMark>;
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  userMap:
    | Map<string, { id: string; name?: string; email?: string } | undefined>
    | Record<string, { name?: string; email?: string } | undefined>;
  onEdit: (invoice: IInvoice) => void;
  onCopy?: (invoice: IInvoice) => void;
  onDelete: (invoice: IInvoice) => void;
  onHistory: (invoice: IInvoice) => void;
  onMove: (invoice: IInvoice) => void;
  onFiles?: (invoice: IInvoice) => void;
  onMarkForPayment?: (invoice: IInvoice) => void;
  onMarkForApproval?: (invoice: IInvoice) => void;
  onClearPaymentMark?: (markId: string) => void;
  onApproveMark?: (markId: string) => void;
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  handleDraftChange: (field: keyof DraftInvoiceForm, value: unknown) => void;
  handleDraftKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  setAmountDisplay: Dispatch<SetStateAction<string>>;
  setAmountFocused: Dispatch<SetStateAction<boolean>>;
  setDraftErrors: Dispatch<SetStateAction<DraftFieldErrors>>;
  setPayModalInvoice: Dispatch<SetStateAction<IInvoice | null>>;
  setPayModalAmount: Dispatch<SetStateAction<string>>;
  setClearConfirmInvoiceId: Dispatch<SetStateAction<string | null>>;
  setPartialModal: Dispatch<
    SetStateAction<{ invoice: IInvoice; amount: string; comment: string } | null>
  >;
}

/**
 * Возвращает конфигурацию рендереров колонок десктопной таблицы:
 * заголовок, ширина по умолчанию, рендер ячейки и рендер черновика.
 */
export function useGroupedInvoiceTableColumnRenderers({
  draftForm,
  draftErrors,
  amountFocused,
  amountDisplay,
  counterpartyResults,
  permissions,
  marksByInvoice,
  filesByInvoice,
  userMap,
  onEdit,
  onCopy,
  onDelete,
  onHistory,
  onMove,
  onFiles,
  onMarkForPayment,
  onMarkForApproval,
  onClearPaymentMark,
  onApproveMark,
  onDraftChange,
  handleDraftChange,
  handleDraftKeyDown,
  setAmountDisplay,
  setAmountFocused,
  setDraftErrors,
  setPayModalInvoice,
  setPayModalAmount,
  setClearConfirmInvoiceId,
  setPartialModal,
}: UseGroupedInvoiceTableColumnRenderersParams): Record<InvoiceColumnId, InvoiceColumnRenderer> {
  return {
    counterparty: {
      width: 180,
      header: 'Контрагент',
      renderCell: () => null,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <Autocomplete
            size="xs"
            value={draftForm?.counterparty ?? ''}
            onChange={(v) => handleDraftChange('counterparty', v)}
            onKeyDown={handleDraftKeyDown}
            data={counterpartyResults || []}
            placeholder="Контрагент"
            error={draftErrors.counterparty}
          />
        </div>
      ),
    },
    purpose: {
      width: 200,
      header: 'Назначение платежа',
      renderCell: (invoice) => <>{invoice.purpose}</>,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <TextInput
            size="xs"
            value={draftForm?.purpose ?? ''}
            onChange={(e) => handleDraftChange('purpose', e.currentTarget.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Назначение"
            error={draftErrors.purpose}
          />
        </div>
      ),
    },
    contract_no: {
      width: 150,
      header: 'Договор',
      renderCell: (invoice) => <>{invoice.contract_no || '—'}</>,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <TextInput
            size="xs"
            value={draftForm?.contract_no ?? ''}
            onChange={(e) => handleDraftChange('contract_no', e.currentTarget.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Договор"
          />
        </div>
      ),
    },
    invoice_no: {
      width: 120,
      header: 'Счет',
      renderCell: (invoice) => <>{invoice.invoice_no}</>,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <TextInput
            size="xs"
            value={draftForm?.invoice_no ?? ''}
            onChange={(e) => handleDraftChange('invoice_no', e.currentTarget.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Счет"
            error={draftErrors.invoice_no}
          />
        </div>
      ),
    },
    amount: {
      width: 100,
      header: 'Сумма',
      renderCell: (invoice) => (
        <Text fw={400}>{formatAmountNumber(getEffectiveAmount(invoice))}</Text>
      ),
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <NumberInput
            size="xs"
            value={
              amountFocused && draftForm?.amount === 0
                ? (undefined as unknown as number)
                : (draftForm?.amount ?? 0)
            }
            onChange={(v) => {
              setAmountDisplay(String(v ?? ''));
              handleDraftChange('amount', v ?? 0);
              setDraftErrors((prev) => {
                const next = { ...prev };
                delete next.amount;
                return next;
              });
            }}
            onKeyDown={handleDraftKeyDown}
            onFocus={() => {
              if (draftForm?.amount === 0) {
                setAmountFocused(true);
                setAmountDisplay('');
                setDraftErrors((prev) => {
                  const next = { ...prev };
                  delete next.amount;
                  return next;
                });
              }
            }}
            onBlur={() => {
              setAmountFocused(false);
              if (amountDisplay.trim() === '') {
                setAmountDisplay('0');
                handleDraftChange('amount', 0);
              }
            }}
            thousandSeparator=" "
            decimalSeparator=","
            placeholder="Сумма"
            error={draftErrors.amount}
          />
        </div>
      ),
    },
    paid: {
      width: 130,
      header: 'Оплачено',
      renderCell: (invoice) => {
        const amounts = invoice.payment_amounts;
        if (permissions.canPay) {
          if (amounts.length > 0) {
            const isLast = amounts.length === 1;
            return (
              <Group gap={2} wrap="nowrap">
                <Badge color="green" variant="light">
                  {formatAmountRub(amounts[0]!)}
                </Badge>
                {isLast && (
                  <Tooltip label="Снять оплату">
                    <ActionIcon
                      size="md"
                      color="red"
                      variant="filled"
                      aria-label="Снять оплату"
                      onClick={() => setClearConfirmInvoiceId(invoice.id)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            );
          }
          if (invoice.paid) {
            return (
              <Badge color="green" variant="light">
                {formatAmountRub(
                  invoice.payment_amounts?.reduce((s, a) => s + a, 0) ?? invoice.amount,
                )}
              </Badge>
            );
          }
          return (
            <Button
              size="compact-xs"
              variant="light"
              color="orange"
              onClick={() => {
                setPayModalInvoice(invoice);
                setPayModalAmount(String(invoice.amount));
              }}
            >
              Оплатить
            </Button>
          );
        }
        if (amounts.length > 0) {
          return (
            <Badge color="green" variant="light">
              {formatAmountRub(amounts[0]!)}
            </Badge>
          );
        }
        if (invoice.paid) {
          return (
            <Badge color="green" variant="light">
              {formatAmountRub(invoice.paid_amount ?? invoice.amount)}
            </Badge>
          );
        }
        return (
          <Badge color="orange" variant="light">
            Не оплачено
          </Badge>
        );
      },
      renderDraft: () => null,
    },
    paid_date: {
      width: 120,
      header: 'Дата оплаты',
      renderCell: (invoice) => (
        <>{invoice.paid_date ? dayjs(invoice.paid_date).format('DD.MM.YYYY') : '—'}</>
      ),
      renderDraft: () => null,
    },
    comment: {
      width: 180,
      header: 'Комментарий',
      renderCell: (invoice) => <>{invoice.comment || '—'}</>,
      renderDraft: () => (
        <div style={DRAFT_INPUT_STYLE} className="draft-input-cell">
          <TextInput
            size="xs"
            value={draftForm?.comment ?? ''}
            onChange={(e) => handleDraftChange('comment', e.currentTarget.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Комментарий"
          />
        </div>
      ),
    },
    files: {
      width: 40,
      header: 'Файлы',
      renderCell: (invoice) => {
        const invoiceFiles = filesByInvoice?.[invoice.id];
        if (invoiceFiles?.length) {
          return (
            <Stack gap={2}>
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
          );
        }
        return (
          <Text size="xs" c="dimmed">
            —
          </Text>
        );
      },
      renderDraft: () => (
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
      ),
    },
    actions: {
      width: 50,
      header: 'Действия',
      renderCell: (invoice) => (
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
        />
      ),
      renderDraft: () => null,
    },
    payment_mark: {
      width: 180,
      header: 'Отметка',
      renderCell: (invoice) => {
        const lookupId = invoice.id.endsWith('__r') ? invoice.id.slice(0, -3) : invoice.id;
        const mark = invoice.paid ? undefined : marksByInvoice[lookupId];
        return (
          <PaymentMarkCell
            invoice={invoice}
            mark={mark}
            canMarkPayment={permissions.canMarkPayment}
            canViewPaymentMarks={permissions.canViewPaymentMarks}
            canRemoveApprovalMark={permissions.canRemoveApprovalMark}
            onMarkForPayment={onMarkForPayment}
            onMarkForApproval={onMarkForApproval}
            onOpenPartialModal={(inv) => setPartialModal({ invoice: inv, amount: '', comment: '' })}
            onClearPaymentMark={onClearPaymentMark}
            onApproveMark={onApproveMark}
          />
        );
      },
      renderDraft: () => null,
    },
    initiator: {
      width: 120,
      header: 'Инициатор',
      renderCell: (invoice) => (
        <>
          {getInitiatorDisplayName(invoice.created_by, invoice.created_by_name, userMap as never)}
        </>
      ),
      renderDraft: () => null,
    },
  };
}
