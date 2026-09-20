import { useMemo, useState, useEffect, useRef } from 'react';
import { Affix, Paper, Title, Group, Skeleton, Stack, Text, ActionIcon, Tooltip, Menu, Box, Button, useMantineTheme } from '@mantine/core';
import { IconPrinter, IconSettings, IconFileExport, IconChevronsDown, IconChevronsUp, IconX, IconFilter, IconCheck } from '@tabler/icons-react';
import { useInvoices } from '@/shared/hooks/useInvoices';
import { useSearchInvoices } from '@/shared/hooks/useSearchInvoices';
import { usePaymentMarks } from '@/shared/hooks/usePaymentMarks';
import { useOrgInvoiceFiles } from '@/shared/hooks/useInvoiceFiles';
import { useUserSetting, useUpsertUserSetting } from '@/shared/hooks/useUserSettings';
import { useAccessibleObjects } from '@/shared/hooks/useAccessibleObjects';
import { useInvoicePermissions } from '@/shared/hooks/useInvoicePermissions';
import { useUserMap } from '@/shared/hooks/useUserMap';
import { InvoiceColumnSettingsModal } from '@/features/invoices/InvoiceColumnSettingsModal';
import { PrintableInvoices } from '@/features/invoices/PrintableInvoices';
import { exportInvoicesToExcel } from '@/features/invoices/exportInvoicesToExcel';
import { SearchResultsView } from '@/features/invoices/components/SearchResultsView';
import { InvoiceObjectBlock } from '@/features/invoices/components/InvoiceObjectBlock';
import { DEFAULT_VISIBLE_COLUMNS } from '@/features/invoices/invoice-columns';
import { getVisibleColumnsForRole } from '@/features/invoices/invoice-column-visibility';
import { CollapsedObjectsProvider, useCollapsedObjects } from '@/shared/context/CollapsedObjectsContext';

import { useOrg } from '@/shared/context/OrgContext';
import { useSearch } from '@/shared/context/SearchContext';
import { useInvoiceNavigation } from '@/shared/context/InvoiceNavigationContext';
import { formatAmountRub } from '@/shared/utils/format-currency';
import type { InvoiceFilterType } from '@/features/invoices/utils/invoice-filter';
import {
  ALL_INVOICE_FILTERS,
  REDUCED_INVOICE_FILTERS,
  INVOICE_FILTER_LABELS,
  filterInvoices,
} from '@/features/invoices/utils/invoice-filter';
import type { IInvoice, IInvoiceFile, IAccountingObject, IPaymentMark, InvoiceColumnId } from '@/shared/types';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { normalizeInvoiceForDate } from '@/shared/utils/invoice-utils';
import { useMediaQuery } from '@mantine/hooks';

interface InvoiceSectionProps {
  orgId: string;
  date: string;
  searchAll: boolean;
  onBackToDate: () => void;
  bankTotal: number;
}

function stripInvisible(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[\u00a0\u2000-\u200f\u2028-\u202f\u205f\u3000\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeHighlightedIds(
  searchText: string,
  searchResults: IInvoice[] | undefined,
  invoices: IInvoice[] | undefined,
): string[] {
  if (!searchText) return [];
  if (searchResults) return searchResults.map((i) => i.id);
  if (!invoices) return [];

  const lower = stripInvisible(searchText).toLowerCase();
  return invoices
    .filter(
      (inv) =>
        stripInvisible(inv.counterparty).toLowerCase().includes(lower) ||
        stripInvisible(inv.purpose).toLowerCase().includes(lower) ||
        inv.contract_no.toLowerCase().includes(lower) ||
        inv.invoice_no.toLowerCase().includes(lower) ||
        inv.comment.toLowerCase().includes(lower) ||
        String(inv.amount).includes(lower),
    )
    .map((i) => i.id);
}

interface ObjectsListProps {
  orgId: string;
  date: string;
  objects: IAccountingObject[];
  invoices: IInvoice[] | undefined;
  activeFilters: InvoiceFilterType[];
  highlightedIds: string[];
  hasSearch: boolean;
  draftObjectId: string | null;
  permissions: { canCreate: boolean; role: string };
  paymentMarks: IPaymentMark[] | undefined;
  filesByInvoice: Record<string, IInvoiceFile[]>;
  visibleColumns: InvoiceColumnId[];
  onOpenDraft: (id: string) => void;
  onCancelDraft: () => void;
  onPrint?: (objId: string) => void;
  onExport?: (objId: string) => void;
  onColumnSettingsClick: () => void;
  onPrintAll: () => void;
  onExportAll: () => void;
  activeFilters: InvoiceFilterType[];
  onActiveFiltersChange: (filters: InvoiceFilterType[]) => void;
  paidTodayTotal: number;
}

function ObjectsList({
  orgId,
  date,
  objects,
  invoices,
  activeFilters,
  highlightedIds,
  hasSearch,
  draftObjectId,
  permissions,
  paymentMarks,
  filesByInvoice,
  visibleColumns,
  onOpenDraft,
  onCancelDraft,
  onPrint,
  onExport,
  onColumnSettingsClick,
  onPrintAll,
  onExportAll,
  onActiveFiltersChange,
  paidTodayTotal,
}: ObjectsListProps) {
  const { collapsedIds, collapseAll, expandAll } = useCollapsedObjects();
  const allCollapsed = objects.length > 0 && objects.every((o) => collapsedIds.has(o.id));
  const isFullAccess = permissions.role === 'admin' || permissions.role === 'moderator' || permissions.role === 'boss';

  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  const prevHasSearchRef = useRef(hasSearch);
  useEffect(() => {
    if (hasSearch && !prevHasSearchRef.current) expandAll();
    prevHasSearchRef.current = hasSearch;
  }, [hasSearch, expandAll]);

  const filterMenu = (
    <Menu shadow="md" width={240} closeOnItemClick={false}>
      <Menu.Target>
        <Button
          size="compact-sm"
          variant="light"
          style={{ padding: '0 20px' }}
          color={activeFilters.length > 0 ? 'blue' : 'gray'}
          leftSection={<IconFilter size={16} />}
        >
          {activeFilters.length > 0 ? `Фильтр (${activeFilters.length})` : 'Фильтр'}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Статус счёта</Menu.Label>
        {(isFullAccess ? ALL_INVOICE_FILTERS : REDUCED_INVOICE_FILTERS).map((filter) => {
          const isActive = activeFilters.includes(filter);
          return (
            <Menu.Item
              key={filter}
              leftSection={
                isActive ? <IconCheck size={16} color="var(--mantine-color-blue-filled)" /> : <Box w={16} />
              }
              color={isActive ? 'blue' : undefined}
              onClick={() =>
                onActiveFiltersChange(
                  isActive
                    ? activeFilters.filter((f) => f !== filter)
                    : [...activeFilters, filter],
                )
              }
            >
              {INVOICE_FILTER_LABELS[filter]}
            </Menu.Item>
          );
        })}
        <Menu.Divider />
        <Menu.Item
          color="red"
          disabled={activeFilters.length === 0}
          leftSection={<IconX size={16} />}
          closeMenuOnClick
          onClick={() => onActiveFiltersChange([])}
        >
          Сбросить
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  const collapseButton =
    objects.length > 1 ? (
      <Button
        size="compact-sm"
        variant="light"
        color="gray"
        flex="1"
        rightSection={allCollapsed ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
        onClick={allCollapsed ? expandAll : collapseAll}
        leftSection={allCollapsed ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
      >
        {allCollapsed ? 'Развернуть' : 'Свернуть'}
      </Button>
    ) : null;

  return (
    <>
      <Box hiddenFrom="sm">
        <Group justify="space-between" mb="xs" wrap="wrap" gap="xs">
          <Group gap={8} justify="flex-start">
            <Title order={5}>Счета</Title>
            {!isMobile && (
              <Tooltip label="Настройка колонок">
                <ActionIcon
                  size="md"
                  variant="subtle"
                  color="gray"
                  aria-label="Настройка колонок"
                  onClick={onColumnSettingsClick}
                >
                  <IconSettings size={20} />
                </ActionIcon>
              </Tooltip>)}
            {!isMobile && (
              <Tooltip label="Печать">
                <ActionIcon
                  size="md"
                  variant="subtle"
                  color="gray"
                  aria-label="Печать"
                  onClick={onPrintAll}
                >
                  <IconPrinter size={20} />
                </ActionIcon>
              </Tooltip>)}
            <Tooltip label="Экспорт в Excel">
              <ActionIcon
                size="md"
                variant="subtle"
                color="gray"
                aria-label="Экспорт в Excel"
                onClick={onExportAll}
              >
                <IconFileExport size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>
          {paidTodayTotal > 0 && (
            <Text size="sm" fw={700}>
              Оплачено: {formatAmountRub(paidTodayTotal)}
            </Text>
          )}
        </Group>
        <Group gap="xs" mb="sm" wrap="wrap">
          {filterMenu}
          {collapseButton}
        </Group>
      </Box>
      <Box visibleFrom="sm">
        <Group justify="space-between" mb="sm" wrap="wrap">
          <Group gap={8} justify="flex-start" flex="1">

            <Title order={5}>Счета</Title>
            <Tooltip label="Настройка колонок">
              <ActionIcon
                size="md"
                variant="subtle"
                color="gray"
                aria-label="Настройка колонок"
                onClick={onColumnSettingsClick}
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
                onClick={onPrintAll}
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
                onClick={onExportAll}
              >
                <IconFileExport size={20} />
              </ActionIcon>
            </Tooltip>

            {filterMenu}

            {collapseButton}
          </Group>
          {paidTodayTotal > 0 && (
            <Text size="lg">
              Оплачено: {formatAmountRub(paidTodayTotal)}
            </Text>
          )}
        </Group>
      </Box>
      {objects.map((obj) => (
        <InvoiceObjectBlock
          key={obj.id}
          obj={obj}
          invoices={invoices}
          activeFilters={activeFilters}
          orgId={orgId}
          date={date}
          highlightedIds={highlightedIds}
          hasSearch={hasSearch}
          draftObjectId={draftObjectId}
          permissions={{ canCreate: permissions.canCreate }}
          accountingObjects={objects}
          paymentMarks={paymentMarks}
          filesByInvoice={filesByInvoice}
          visibleColumns={visibleColumns}
          onOpenDraft={onOpenDraft}
          onCancelDraft={onCancelDraft}
          onPrint={onPrint}
          onExport={onExport}
        />
      ))}
    </>
  );
}

function flashHighlightRow(invoiceId: string) {
  const el = document.querySelector(
    `[data-highlight-id="${CSS.escape(invoiceId)}"]`,
  );
  if (!el || el.classList.contains('row-flash')) return;
  el.classList.add('row-flash');
  window.setTimeout(() => {
    el.classList.remove('row-flash');
  }, 2600);
}

function AutoExpandOnHighlight({
  highlightedInvoiceId,
  highlightRequestId,
  objects,
  invoices,
}: {
  highlightedInvoiceId: string | null;
  highlightRequestId: number;
  objects: IAccountingObject[] | undefined;
  invoices: IInvoice[] | undefined;
}) {
  const { expand } = useCollapsedObjects();

  const lastHandledRequestId = useRef(0);

  useEffect(() => {
    if (!highlightedInvoiceId || !invoices || !objects) return;
    if (highlightRequestId === lastHandledRequestId.current) return;
    lastHandledRequestId.current = highlightRequestId;

    const target = invoices.find((i) => i.id === highlightedInvoiceId);
    if (!target) return;
    const objectId = normalizeRelationId(target.accounting_object_id);
    const hasObject = objects.some((o) => o.id === objectId);
    if (hasObject) expand([objectId]);

    const el = document.querySelector(
      `[data-highlight-id="${CSS.escape(highlightedInvoiceId)}"]`,
    );
    if (el) {
      flashHighlightRow(highlightedInvoiceId);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const timer = setTimeout(() => {
      const targetEl = document.querySelector(
        `[data-highlight-id="${CSS.escape(highlightedInvoiceId)}"]`,
      );
      if (targetEl) {
        flashHighlightRow(highlightedInvoiceId);
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [highlightedInvoiceId, highlightRequestId, invoices, objects, expand]);

  return null;
}

export function InvoiceSection({
  orgId,
  date,
  searchAll,
  onBackToDate,
  bankTotal,
}: InvoiceSectionProps) {
  const { debouncedSearchText } = useSearch();
  const {
    highlightedInvoiceId,
    highlightRequestId,
    clearHighlight,
  } = useInvoiceNavigation();
  const objects = useAccessibleObjects(orgId);
  const { data: invoices } = useInvoices(orgId, date);
  const displayInvoices = useMemo(
    () => (invoices ?? []).map((inv) => normalizeInvoiceForDate(inv, date)),
    [invoices, date],
  );
  const { data: searchResults } = useSearchInvoices(orgId);
  const { data: paymentMarks } = usePaymentMarks(orgId);
  const { data: orgFiles } = useOrgInvoiceFiles(orgId);
  const permissions = useInvoicePermissions(orgId);
  const usersMap = useUserMap();
  const { currentOrg } = useOrg();
  const [draftObjectId, setDraftObjectId] = useState<string | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [printingTarget, setPrintingTarget] = useState<null | 'all' | string>(null);
  const [activeFilters, setActiveFilters] = useState<InvoiceFilterType[]>([]);

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
    const allowedColumns = getVisibleColumnsForRole(permissions.role);
    if (Array.isArray(savedColumns) && savedColumns.length > 0) {
      return savedColumns.filter((c) => allowedColumns.includes(c)) as InvoiceColumnId[];
    }
    return DEFAULT_VISIBLE_COLUMNS.filter((c) => allowedColumns.includes(c));
  }, [savedColumns, permissions.role]);

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
    () =>
      highlightedInvoiceId
        ? Array.from(new Set([...computeHighlightedIds(debouncedSearchText, searchResults, displayInvoices), highlightedInvoiceId]))
        : computeHighlightedIds(debouncedSearchText, searchResults, displayInvoices),
    [debouncedSearchText, searchResults, displayInvoices, highlightedInvoiceId],
  );

  const markedTotal = useMemo(() => {
    if (!displayInvoices || !paymentMarks) return 0;
    return displayInvoices.reduce((sum, inv) => {
      const mark = paymentMarks.find((m) => m.invoice_id === inv.id);
      if (!mark) return sum;
      return sum + (mark.amount ?? inv.amount);
    }, 0);
  }, [displayInvoices, paymentMarks]);

  const isOverBalance = markedTotal > bankTotal;

  const paidTodayTotal = useMemo(() => {
    if (!displayInvoices) return 0;
    return displayInvoices
      .filter((inv) => inv.paid && inv.paid_date === date)
      .reduce((sum, inv) => {
        if (inv.payment_amounts?.length) {
          return sum + inv.payment_amounts.reduce((s, a) => s + a, 0);
        }
        return sum + (inv.paid_amount ?? inv.amount);
      }, 0);
  }, [displayInvoices, date]);

  const printInvoices = useMemo(
    () => filterInvoices(displayInvoices, paymentMarks, activeFilters),
    [displayInvoices, paymentMarks, activeFilters],
  );

  const grandTotal = useMemo(() => {
    return printInvoices.reduce((sum, inv) => {
      if (!inv.paid) return sum + inv.amount;
      return sum;
    }, 0);
  }, [printInvoices]);

  const handleExportExcel = (objectId?: string) => {
    if (!currentOrg || !displayInvoices || !objects) return;
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
      usersMap,
    });
  };

  const objectIds = useMemo(() => objects?.map((o) => o.id) ?? [], [objects]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('.mantine-Drawer-root')) return;
      clearHighlight();
      document.querySelectorAll('.row-flash').forEach((el) => el.classList.remove('row-flash'));
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [clearHighlight]);

  if (!orgId) return null;

  if (!objects)
    return (
      <Stack gap="sm" py="xs">
        <Skeleton height={32} radius="sm" />
        <Skeleton height={140} radius="md" />
        <Skeleton height={140} radius="md" />
      </Stack>
    );

  if (searchAll && searchResults) {
    return (
      <SearchResultsView
        searchText={debouncedSearchText}
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
        usersMap={usersMap}
        role={permissions.role}
      />
    );
  }

  return (
    <>
      <CollapsedObjectsProvider orgId={orgId} objectIds={objectIds}>
        <AutoExpandOnHighlight
          highlightedInvoiceId={highlightedInvoiceId}
          highlightRequestId={highlightRequestId}
          objects={objects}
          invoices={displayInvoices}
        />
        <ObjectsList
          orgId={orgId}
          date={date}
          objects={objects}
          invoices={displayInvoices}
          activeFilters={activeFilters}
          highlightedIds={highlightedIds}
          hasSearch={!!debouncedSearchText}
          draftObjectId={draftObjectId}
          permissions={{ canCreate: permissions.canCreate, role: permissions.role }}
          paymentMarks={paymentMarks}
          filesByInvoice={filesByInvoice}
          visibleColumns={visibleColumns}
          onOpenDraft={(id) => setDraftObjectId(id)}
          onCancelDraft={() => setDraftObjectId(null)}
          onPrint={(objId) => handlePrint(objId)}
          onExport={(objId) => handleExportExcel(objId)}
          onColumnSettingsClick={() => setColumnSettingsOpen(true)}
          onPrintAll={() => handlePrint()}
          onExportAll={() => handleExportExcel()}
          onActiveFiltersChange={setActiveFilters}
          paidTodayTotal={paidTodayTotal}
        />
      </CollapsedObjectsProvider>
      {grandTotal > 0 && (
        <Paper withBorder p="md" mt="lg">
          <Text ta="right" fw={700} size="lg">
            ИТОГО: {formatAmountRub(grandTotal)}
          </Text>
        </Paper>
      )}
      <InvoiceColumnSettingsModal
        key={columnSettingsOpen ? 'open' : 'closed'}
        opened={columnSettingsOpen}
        value={visibleColumns}
        onChange={handleColumnChange}
        onClose={() => setColumnSettingsOpen(false)}
        role={permissions.role}
      />
      {permissions.canViewPaymentMarks && markedTotal > 0 && (
        <Affix position={{ bottom: 20, right: 20 }} zIndex={100}>
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
