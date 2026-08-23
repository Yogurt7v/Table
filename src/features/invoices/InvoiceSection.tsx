import { useMemo, useState, useEffect } from 'react';
import { Affix, Paper, Title, Group, Loader, Text, ActionIcon, Tooltip, Switch, Box } from '@mantine/core';
import { IconPrinter, IconSettings, IconFileExport } from '@tabler/icons-react';
import { useInvoices } from '@/shared/hooks/useInvoices';
import { useSearchInvoices } from '@/shared/hooks/useSearchInvoices';
import { usePaymentMarks } from '@/shared/hooks/usePaymentMarks';
import { useOrgInvoiceFiles } from '@/shared/hooks/useInvoiceFiles';
import { useUserSetting, useUpsertUserSetting } from '@/shared/hooks/useUserSettings';
import { useAccessibleObjects } from '@/shared/hooks/useAccessibleObjects';
import { useInvoicePermissions } from '@/shared/hooks/useInvoicePermissions';
import { InvoiceColumnSettingsModal } from '@/features/invoices/InvoiceColumnSettingsModal';
import { PrintableInvoices } from '@/features/invoices/PrintableInvoices';
import { exportInvoicesToExcel } from '@/features/invoices/exportInvoicesToExcel';
import { SearchResultsView } from '@/features/invoices/components/SearchResultsView';
import { InvoiceObjectBlock } from '@/features/invoices/components/InvoiceObjectBlock';
import { DEFAULT_VISIBLE_COLUMNS } from '@/features/invoices/invoice-columns';
import { useOrg } from '@/shared/context/OrgContext';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { getInvoicePaymentInfo } from '@/features/invoices/utils/expand-invoice-rows';
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
  const objects = useAccessibleObjects(orgId);
  const { data: invoices } = useInvoices(orgId, date);
  const { data: searchResults } = useSearchInvoices(orgId);
  const { data: paymentMarks } = usePaymentMarks(orgId);
  const { data: orgFiles } = useOrgInvoiceFiles(orgId);
  const permissions = useInvoicePermissions(orgId);
  const { currentOrg } = useOrg();
  const [draftObjectId, setDraftObjectId] = useState<string | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [printingTarget, setPrintingTarget] = useState<null | 'all' | string>(null);
  const [hidePaid, setHidePaid] = useState(false);

  const isPrinting = printingTarget !== null;

  const handlePrint = (objectId?: string) => {
    setPrintingTarget(objectId ?? 'all');
  };

  useEffect(() => {
    if (printingTarget) {
      const timer = setTimeout(() => window.print(), 100);
      return () => clearTimeout(timer);
    }
  }, [printingTarget]);

  useEffect(() => {
    const onAfterPrint = () => setPrintingTarget(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

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

  const paidTodayTotal = useMemo(() => {
    if (!invoices) return 0;
    return invoices
      .filter((inv) => inv.paid && inv.paid_date === date)
      .reduce((sum, inv) => {
        if (inv.payment_amounts?.length) {
          return sum + inv.payment_amounts.reduce((s, a) => s + a, 0);
        }
        return sum + (inv.paid_amount ?? inv.amount);
      }, 0);
  }, [invoices, date]);

  const printInvoices = useMemo(() => {
    if (!hidePaid || !invoices) return invoices ?? [];
    return invoices.flatMap((inv) => {
      if (!inv.paid) return [inv];
      const { amounts, remaining } = getInvoicePaymentInfo(inv);
      if (amounts.length === 0) return [];
      if (remaining <= 0) return [];
      return [{ ...inv, amount: remaining, paid: false, paid_amount: null, payment_amounts: [], paid_date: null }];
    });
  }, [invoices, hidePaid]);

  const handleExportExcel = (objectId?: string) => {
    if (!currentOrg || !invoices || !objects) return;
    const targetObjects = objectId
      ? objects.filter((obj) => obj.id === objectId)
      : objects;
    const targetInvoices = objectId
      ? printInvoices.filter((inv) => normalizeRelationId(inv.accounting_object_id) === objectId)
      : printInvoices;
    exportInvoicesToExcel({
      invoices: targetInvoices,
      objects: targetObjects,
      date,
      visibleColumns,
      paymentMarks,
      canViewPaymentMarks: permissions.canViewPaymentMarks,
      canViewPaidDate: permissions.canViewPaidDate,
      orgName: currentOrg.name,
    });
  };

  if (!orgId) return null;

  if (!objects) return <Loader />;

  const tableHeader = (
    <Group justify="space-between" mb="sm" wrap="wrap">
      <Group gap={4}>
        <Title order={5}>Счета</Title>
        <Tooltip label="Настройка колонок">
          <ActionIcon
            size="md"
            variant="subtle"
            color="gray"
            aria-label="Настройка колонок"
            onClick={() => setColumnSettingsOpen(true)}
          >
            <IconSettings size={20} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Печать">
          <ActionIcon
            size="md"
            variant="subtle"
            color="gray"
            aria-label="Печать"
            onClick={handlePrint}
          >
            <IconPrinter size={20} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Экспорт в Excel">
          <ActionIcon
            size="md"
            variant="subtle"
            color="gray"
            aria-label="Экспорт в Excel"
            onClick={handleExportExcel}
          >
            <IconFileExport size={20} />
          </ActionIcon>
        </Tooltip>
        {(permissions.role === 'admin' || permissions.role === 'moderator' || permissions.role === 'boss') && (
          <Switch
            size="xs"
            label="Скрыть оплаченные"
            checked={hidePaid}
            onChange={(e) => setHidePaid(e.currentTarget.checked)}
          />
        )}
        {(permissions.role === 'admin' || permissions.role === 'moderator' || permissions.role === 'boss') && paidTodayTotal > 0 && (
          <Text size="sm" c="dimmed">
            Оплачено: {formatAmountRub(paidTodayTotal)}
          </Text>
        )}
      </Group>
    </Group>
  );

  if (searchAll && searchResults) {
    return (
      <SearchResultsView
        searchText={searchText}
        searchResults={searchResults}
        date={date}
        onBackToDate={onBackToDate}
      />
    );
  }

  if (isPrinting) {
    const printObjects = objects.filter(
      (obj) => printingTarget === 'all' || obj.id === printingTarget,
    );
    const printInvoicesFiltered =
      printingTarget === 'all'
        ? printInvoices
        : printInvoices.filter(
            (inv) => normalizeRelationId(inv.accounting_object_id) === printingTarget,
          );
    return (
      <PrintableInvoices
        invoices={printInvoicesFiltered}
        objects={printObjects}
        date={date}
        visibleColumns={visibleColumns}
        paymentMarks={paymentMarks}
        canViewPaymentMarks={permissions.canViewPaymentMarks}
        canViewPaidDate={permissions.canViewPaidDate}
      />
    );
  }

  return (
    <>
      {tableHeader}
      {objects.map((obj) => (
        <InvoiceObjectBlock
          key={obj.id}
          obj={obj}
          invoices={invoices}
          hidePaid={hidePaid}
          orgId={orgId}
          date={date}
          highlightedIds={highlightedIds}
          draftObjectId={draftObjectId}
          permissions={{ canCreate: permissions.canCreate }}
          accountingObjects={objects}
          paymentMarks={paymentMarks}
          filesByInvoice={filesByInvoice}
          visibleColumns={visibleColumns}
          onOpenDraft={(id) => setDraftObjectId(id)}
          onCancelDraft={() => setDraftObjectId(null)}
          onPrint={(objId) => handlePrint(objId)}
          onExport={(objId) => handleExportExcel(objId)}
        />
      ))}
      <InvoiceColumnSettingsModal
        opened={columnSettingsOpen}
        value={visibleColumns}
        onChange={handleColumnChange}
        onClose={() => setColumnSettingsOpen(false)}
      />
      {permissions.canViewPaymentMarks && markedTotal > 0 && (
        <Box visibleFrom="sm">
          <Affix position={{ top: 90, right: 20 }} zIndex={100}>
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
        </Box>
      )}
      {permissions.canViewPaymentMarks && markedTotal > 0 && (
        <Box hiddenFrom="sm">
          <Affix position={{ bottom: 16, right: 16 }} zIndex={100}>
            <Paper
              withBorder
              px="sm"
              py={6}
              radius="xl"
              shadow="lg"
              style={{ backgroundColor: 'var(--mantine-color-body)' }}
            >
              <Text size="sm" fw={700} c={isOverBalance ? 'red' : undefined}>
                К оплате: {formatAmountRub(markedTotal)}
              </Text>
            </Paper>
          </Affix>
        </Box>
      )}
    </>
  );
}
