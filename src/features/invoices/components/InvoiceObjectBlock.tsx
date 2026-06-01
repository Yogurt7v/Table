import { useMemo } from 'react';
import { Paper, Title, Group, Button, Loader, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { InvoiceTable } from '@/features/invoices/InvoiceTable';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { getInvoicePaymentInfo } from '@/features/invoices/utils/expand-invoice-rows';
import type { IInvoice, IAccountingObject, IPaymentMark, IInvoiceFile, InvoiceColumnId } from '@/shared/types';

interface InvoiceObjectBlockProps {
  obj: IAccountingObject;
  invoices: IInvoice[] | undefined;
  hidePaid: boolean;
  orgId: string;
  date: string;
  highlightedIds: string[];
  draftObjectId: string | null;
  permissions: { canCreate: boolean };
  accountingObjects: IAccountingObject[];
  paymentMarks: IPaymentMark[] | undefined;
  filesByInvoice: Record<string, IInvoiceFile[]>;
  visibleColumns: InvoiceColumnId[];
  onOpenDraft: (id: string) => void;
  onCancelDraft: () => void;
}

export function InvoiceObjectBlock({
  obj,
  invoices,
  hidePaid,
  orgId,
  date,
  highlightedIds,
  draftObjectId,
  permissions,
  accountingObjects,
  paymentMarks,
  filesByInvoice,
  visibleColumns,
  onOpenDraft,
  onCancelDraft,
}: InvoiceObjectBlockProps) {
  const objInvoices = useMemo(() => {
    if (hidePaid && invoices) {
      return invoices.flatMap((i) => {
        if (normalizeRelationId(i.accounting_object_id) !== obj.id) return [];
        if (!i.paid) return [i];
        const { amounts, remaining } = getInvoicePaymentInfo(i);
        if (amounts.length === 0) return [];
        if (remaining <= 0) return [];
        return [{ ...i, amount: remaining, paid: false, paid_amount: null, payment_amounts: [], paid_date: null }];
      });
    }
    return invoices?.filter((i) => normalizeRelationId(i.accounting_object_id) === obj.id) ?? [];
  }, [invoices, hidePaid, obj.id]);

  const isDraftOpen = draftObjectId === obj.id;
  const hasDraftElsewhere = draftObjectId !== null && draftObjectId !== obj.id;

  const totalAmount = useMemo(() => {
    return objInvoices.reduce((sum, inv) => {
      if (!inv.paid) return sum + inv.amount;
      const { amounts, remaining } = getInvoicePaymentInfo(inv);
      if (amounts.length > 0 && remaining > 0) return sum + remaining;
      return sum;
    }, 0);
  }, [objInvoices]);

  return (
    <Paper
      key={obj.id}
      withBorder
      p="sm"
      style={{ borderLeft: '3px solid var(--org-color, #228be6)' }}
    >
      <Group justify="space-between" mb="sm">
        <Title order={5}>{obj.name}</Title>
        {permissions.canCreate && (
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            disabled={isDraftOpen || hasDraftElsewhere}
            onClick={() => onOpenDraft(obj.id)}
          >
            Добавить счёт
          </Button>
        )}
      </Group>
      {!invoices ? (
        <Loader size="sm" />
      ) : (
        <>
          <InvoiceTable
            orgId={orgId}
            objectId={obj.id}
            date={date}
            invoices={objInvoices}
            highlightedIds={highlightedIds}
            isDraftOpen={isDraftOpen}
            onOpenDraft={onOpenDraft}
            onCancelDraft={onCancelDraft}
            accountingObjects={accountingObjects}
            paymentMarks={paymentMarks}
            filesByInvoice={filesByInvoice}
            visibleColumns={visibleColumns}
          />
          {objInvoices.length > 0 && (
            <Text ta="right" fw={700} mt="md">
              Итого по "{obj.name}": {formatAmountRub(totalAmount)}
            </Text>
          )}
        </>
      )}
    </Paper>
  );
}
