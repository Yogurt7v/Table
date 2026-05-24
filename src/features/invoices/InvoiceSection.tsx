import { useMemo, useState } from 'react';
import { Affix, Paper, Title, Button, Group, Loader, Text, Table, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconSettings } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { useInvoices } from '@/shared/hooks/useInvoices';
import { useSearchInvoices } from '@/shared/hooks/useSearchInvoices';
import { usePaymentMarks } from '@/shared/hooks/usePaymentMarks';
import { useOrgInvoiceFiles } from '@/shared/hooks/useInvoiceFiles';
import { useUserSetting, useUpsertUserSetting } from '@/shared/hooks/useUserSettings';
import { useInvoicePermissions } from '@/shared/hooks/useInvoicePermissions';
import { InvoiceTable } from '@/features/invoices/InvoiceTable';
import { InvoiceColumnSettingsModal } from '@/features/invoices/InvoiceColumnSettingsModal';
import { DEFAULT_VISIBLE_COLUMNS } from '@/features/invoices/invoice-columns';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import type { IInvoice, IInvoiceFile, InvoiceColumnId } from '@/shared/types';

interface InvoiceSectionProps {
  orgId: string;
  date: string;
  searchText: string;
  searchAll: boolean;
  onBackToDate: () => void;
  bankTotal: number;
}

function computeHighlightedIds(
  searchText: string,
  searchResults: IInvoice[] | undefined,
  invoices: IInvoice[] | undefined,
): string[] {
  if (!searchText) return [];
  if (searchResults) return searchResults.map((i) => i.id);
  if (!invoices) return [];

  const lower = searchText.toLowerCase();
  return invoices
    .filter(
      (inv) =>
        inv.counterparty.toLowerCase().includes(lower) ||
        inv.purpose.toLowerCase().includes(lower) ||
        inv.contract_no.toLowerCase().includes(lower) ||
        inv.invoice_no.toLowerCase().includes(lower) ||
        inv.comment.toLowerCase().includes(lower) ||
        String(inv.amount).includes(lower),
    )
    .map((i) => i.id);
}

export function InvoiceSection({
  orgId,
  date,
  searchText,
  searchAll,
  onBackToDate,
  bankTotal,
}: InvoiceSectionProps) {
  const { data: objects } = useAccountingObjects(orgId);
  const { data: invoices } = useInvoices(orgId, date);
  const { data: searchResults } = useSearchInvoices(orgId);
  const { data: paymentMarks } = usePaymentMarks(orgId);
  const { data: orgFiles } = useOrgInvoiceFiles(orgId);
  const permissions = useInvoicePermissions(orgId);
  const [draftObjectId, setDraftObjectId] = useState<string | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  const { data: savedColumns } = useUserSetting('invoice_columns');
  const saveColumns = useUpsertUserSetting('invoice_columns');

  const visibleColumns: InvoiceColumnId[] = useMemo(() => {
    if (Array.isArray(savedColumns) && savedColumns.length > 0) {
      return savedColumns as InvoiceColumnId[];
    }
    return DEFAULT_VISIBLE_COLUMNS;
  }, [savedColumns]);

  const handleColumnChange = (columns: InvoiceColumnId[]) => {
    saveColumns.mutate(columns);
  };

  const filesByInvoice = useMemo(() => {
    if (!orgFiles) return {};
    const map: Record<string, IInvoiceFile[]> = {};
    for (const f of orgFiles) {
      if (!map[f.invoice_id]) map[f.invoice_id] = [];
      map[f.invoice_id]!.push(f);
    }
    return map;
  }, [orgFiles]);

  const highlightedIds = useMemo(
    () => computeHighlightedIds(searchText, searchResults, invoices),
    [searchText, searchResults, invoices],
  );

  const markedTotal = useMemo(() => {
    if (!invoices || !paymentMarks) return 0;
    return invoices.reduce((sum, inv) => {
      const mark = paymentMarks.find((m) => m.invoice_id === inv.id);
      if (!mark) return sum;
      return sum + (mark.amount ?? inv.amount);
    }, 0);
  }, [invoices, paymentMarks]);

  const isOverBalance = markedTotal > bankTotal;

  if (!orgId) return null;

  if (!objects) return <Loader />;

  const tableHeader = (
    <Group justify="space-between" mb="sm">
      <Group gap="sm">
        <Title order={5}>Счета</Title>
        <Tooltip label="Настройка колонок">
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={() => setColumnSettingsOpen(true)}
          >
            <IconSettings size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );

  if (searchAll && searchResults) {
    return (
      <Paper withBorder p="sm">
        <Title order={5} mb="sm">
          Результаты поиска: "{searchText}"
        </Title>
        {searchResults.length === 0 ? (
          <Text c="dimmed">Ничего не найдено</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Контрагент</Table.Th>
                <Table.Th>Назначение</Table.Th>
                <Table.Th>Сумма</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {searchResults.map((inv) => (
                <Table.Tr key={inv.id}>
                  <Table.Td>{dayjs(inv.date).format('DD.MM.YYYY')}</Table.Td>
                  <Table.Td>{inv.counterparty}</Table.Td>
                  <Table.Td>{inv.purpose}</Table.Td>
                  <Table.Td>{formatAmountRub(inv.amount)}</Table.Td>
                  <Table.Td>{inv.paid ? 'Оплачено' : 'Ожидает'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <Text size="xs" c="blue" style={{ cursor: 'pointer', marginTop: 8 }} onClick={onBackToDate}>
          ← Вернуться к {dayjs(date).format('DD.MM.YYYY')}
        </Text>
      </Paper>
    );
  }

  return (
    <>
      {tableHeader}
      {objects.map((obj) => {
    const objInvoices =
      invoices?.filter((i) => normalizeRelationId(i.accounting_object_id) === obj.id) ?? [];
    const isDraftOpen = draftObjectId === obj.id;
    const totalAmount = objInvoices.reduce((sum, inv) => {
      return !inv.paid ? sum + inv.amount : sum;
    }, 0);

    return (
      <Paper key={obj.id} withBorder p="sm" style={{ borderLeft: '3px solid var(--org-color, #228be6)' }}>
        <Group justify="space-between" mb="sm">
          <Title order={5}>{obj.name}</Title>
          {permissions.canCreate && (
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              disabled={isDraftOpen || draftObjectId !== null}
              onClick={() => setDraftObjectId(obj.id)}
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
              onCancelDraft={() => setDraftObjectId(null)}
              accountingObjects={objects}
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
  })}
      <InvoiceColumnSettingsModal
        opened={columnSettingsOpen}
        value={visibleColumns}
        onChange={handleColumnChange}
        onClose={() => setColumnSettingsOpen(false)}
      />
      {permissions.canViewPaymentMarks && markedTotal > 0 && (
        <Affix position={{ top: 70, right: 20 }}>
          <Paper withBorder p="sm" shadow="lg">
            <Text
              ta="right"
              fw={700}
              size="md"
              c={isOverBalance ? 'red' : undefined}
            >
              Итого к оплате: {formatAmountRub(markedTotal)}
            </Text>
          </Paper>
        </Affix>
      )}
    </>
  );
}
