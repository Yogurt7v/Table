import { useMemo } from 'react';
import { Paper, Title, Group, Button, Skeleton, Stack, Text, ActionIcon, Tooltip, Collapse } from '@mantine/core';
import { IconPlus, IconPrinter, IconFileExport, IconChevronRight, IconChevronDown } from '@tabler/icons-react';
import { useCollapsedObjects } from '@/shared/context/CollapsedObjectsContext';
import { InvoiceTable } from '@/features/invoices/InvoiceTable';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { matchesInvoiceFilter } from '@/features/invoices/utils/invoice-filter';
import type { InvoiceFilterType } from '@/features/invoices/utils/invoice-filter';
import type { IInvoice, IAccountingObject, IPaymentMark, IInvoiceFile, InvoiceColumnId } from '@/shared/types';


interface InvoiceObjectBlockProps {
  obj: IAccountingObject;
  invoices: IInvoice[] | undefined;
  activeFilters: InvoiceFilterType[];
  orgId: string;
  date: string;
  highlightedIds: string[];
  hasSearch: boolean;
  draftObjectId: string | null;
  permissions: { canCreate: boolean };
  accountingObjects: IAccountingObject[];
  paymentMarks: IPaymentMark[] | undefined;
  filesByInvoice: Record<string, IInvoiceFile[]>;
  visibleColumns: InvoiceColumnId[];
  onOpenDraft: (id: string) => void;
  onCancelDraft: () => void;
  onPrint?: (objId: string) => void;
  onExport?: (objId: string) => void;
}

export function InvoiceObjectBlock({
  obj,
  invoices,
  activeFilters,
  orgId,
  date,
  highlightedIds,
  hasSearch,
  draftObjectId,
  permissions,
  accountingObjects,
  paymentMarks,
  filesByInvoice,
  visibleColumns,
  onOpenDraft,
  onCancelDraft,
  onPrint,
  onExport,
}: InvoiceObjectBlockProps) {
  const objInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices
      .filter((i) => normalizeRelationId(i.accounting_object_id) === obj.id)
      .filter((i) => matchesInvoiceFilter(i, paymentMarks, activeFilters))
      .filter((i) => !hasSearch || highlightedIds.includes(i.id));
  }, [invoices, paymentMarks, activeFilters, obj.id, hasSearch, highlightedIds]);

  const { isCollapsed, toggle } = useCollapsedObjects();
  const collapsed = isCollapsed(obj.id);

  const isDraftOpen = draftObjectId === obj.id;
  const hasDraftElsewhere = draftObjectId !== null && draftObjectId !== obj.id;

  const totalAmount = useMemo(() => {
    return objInvoices.reduce((sum, inv) => {
      if (!inv.paid) return sum + inv.amount;
      return sum;
    }, 0);
  }, [objInvoices]);

  return (
    <Paper
      key={obj.id}
      withBorder
      p="sm"
      style={{
        borderLeft: '3px solid var(--org-color, #228be6)',
        boxShadow: 'var(--mantine-shadow-sm)',
      }}
    >
      <Group
        gap={4}
        mb={0}
        style={{
          position: 'sticky',
          top: 56,
          zIndex: 2,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--mantine-color-body)',
          cursor: 'pointer',
          userSelect: 'none',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-sm)',
          padding: 'var(--mantine-spacing-xs)',
        }}
        onClick={() => toggle(obj.id)}
      >
        {collapsed ? <IconChevronRight size={18} /> : <IconChevronDown size={18} />}
        <Title order={5}>{obj.name}</Title>
        {onPrint && (
          <Tooltip label="Печать">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                onPrint(obj.id);
              }}
            >
              <IconPrinter size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        {onExport && (
          <Tooltip label="Экспорт в Excel">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                onExport(obj.id);
              }}
            >
              <IconFileExport size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      {!invoices ? (
        <Collapse in={!collapsed}>
          <Stack gap="xs">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={22} radius="sm" />
            ))}
          </Stack>
        </Collapse>
      ) : (
        <>
          <Collapse in={!collapsed}>
            <InvoiceTable
              orgId={orgId}
              objectId={obj.id}
              date={date}
              invoices={objInvoices}
              allInvoices={invoices}
              highlightedIds={highlightedIds}
              isDraftOpen={isDraftOpen}
              hasDraftElsewhere={hasDraftElsewhere}
              onOpenDraft={onOpenDraft}
              onCancelDraft={onCancelDraft}
              accountingObjects={accountingObjects}
              paymentMarks={paymentMarks}
              filesByInvoice={filesByInvoice}
              visibleColumns={visibleColumns}
              onAddClick={permissions.canCreate ? () => onOpenDraft(obj.id) : undefined}
            />
            {permissions.canCreate && (
              <Group justify="flex-end" mt="sm">
                <Button
                  size="md"
                  variant="light"
                  leftSection={<IconPlus size={18} />}
                  disabled={isDraftOpen || hasDraftElsewhere}
                  onClick={() => onOpenDraft(obj.id)}
                >
                  Добавить счёт
                </Button>
              </Group>
            )}
          </Collapse>
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
