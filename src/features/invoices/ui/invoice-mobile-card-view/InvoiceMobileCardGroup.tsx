import { Paper, Text } from '@mantine/core';
import type { IInvoice, IInvoiceFile, IPaymentMark } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { getInvoiceNumber, type InvoiceGroup } from '@/shared/utils/group-invoices';
import { InvoiceMobileCardInvoice } from './InvoiceMobileCardInvoice';
import type { InvoiceMobileCardPermissions } from './invoice-mobile-card-view-types';

interface InvoiceMobileCardGroupProps {
  group: InvoiceGroup;
  groups: InvoiceGroup[];
  marksByInvoice: Record<string, IPaymentMark>;
  filesByInvoice?: Record<string, IInvoiceFile[]>;
  highlightedIds: string[];
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
 * Группа карточек по контрагенту: заголовок с суммой неоплаченных (если их > 1)
 * и список карточек счетов этой группы.
 */
export function InvoiceMobileCardGroup({
  group,
  groups,
  marksByInvoice,
  filesByInvoice,
  highlightedIds,
  permissions,
  onMarkForPayment,
  onMarkForApproval,
  onClearPaymentMark,
  onClearPaymentConfirm,
  onOpenPartialModal,
  onApproveMark,
  onDelete,
}: InvoiceMobileCardGroupProps) {
  const unpaidTotal = group.invoices
    .filter((inv) => !inv.paid)
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <Paper
      withBorder
      p="sm"
      style={{
        borderLeft: '3px solid var(--org-color, #228be6)',
        boxShadow: 'var(--mantine-shadow-sm)',
      }}
    >
      <Text
        fw={700}
        size="lg"
        mb="xs"
        px="xs"
        py={4}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--org-color, #228be6) 10%, transparent)',
          borderRadius: 8,
        }}
      >
        {group.counterparty}
        {group.invoices.length > 1 && (
          <Text component="span" size="sm" fw={400} c="dimmed">
            {' '}
            Итого: {formatAmountRub(unpaidTotal)}
          </Text>
        )}
      </Text>

      {group.invoices.map((invoice) => (
        <InvoiceMobileCardInvoice
          key={invoice.id}
          invoice={invoice}
          invoiceNumber={getInvoiceNumber(groups, invoice.id)}
          mark={marksByInvoice[invoice.id]}
          files={filesByInvoice?.[invoice.id]}
          isHighlighted={highlightedIds.includes(invoice.id)}
          permissions={permissions}
          onMarkForPayment={onMarkForPayment}
          onMarkForApproval={onMarkForApproval}
          onClearPaymentMark={onClearPaymentMark}
          onClearPaymentConfirm={onClearPaymentConfirm}
          onOpenPartialModal={onOpenPartialModal}
          onApproveMark={onApproveMark}
          onDelete={onDelete}
        />
      ))}
    </Paper>
  );
}
