import { useEffect, useMemo, useState } from 'react';
import type { IAccountingObject, IInvoiceFile, InvoiceColumnId } from '@/shared/types';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { useSearchInvoices } from '@/features/invoices/hooks/useSearchInvoices';
import { usePaymentMarks } from '@/features/invoices/hooks/usePaymentMarks';
import { useOrgInvoiceFiles } from '@/features/invoices/hooks/useInvoiceFiles';
import { useUserSetting, useUpsertUserSetting } from '@/shared/hooks/useUserSettings';
import { useAccessibleObjects } from '@/features/accounts/hooks/useAccessibleObjects';
import { useInvoicePermissions } from '@/features/invoices/hooks/useInvoicePermissions';
import { useUserMap } from '@/features/admin/hooks/useUserMap';
import { useOrg } from '@/shared/context/OrgContext';
import { useSearch } from '@/shared/context/SearchContext';
import { useInvoiceNavigation } from '@/shared/context/InvoiceNavigationContext';
import { exportInvoicesToExcel } from '@/features/invoices/utils/exportInvoicesToExcel';
import { DEFAULT_VISIBLE_COLUMNS } from '@/features/invoices/model/invoice-columns';
import { getVisibleColumnsForRole } from '@/features/invoices/model/invoice-column-visibility';
import { filterInvoices } from '@/features/invoices/utils/invoice-filter';
import type { InvoiceFilterType } from '@/features/invoices/utils/invoice-filter';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { normalizeInvoiceForDate } from '@/shared/utils/invoice-utils';
import { computeHighlightedIds } from './invoice-section-utils';

interface UseInvoiceSectionParams {
  orgId: string;
  date: string;
  searchAll: boolean;
  bankTotal: number;
}

/**
 * Данные и состояние секции счетов: загрузка, фильтры, колонки, печать,
 * экспорт, подсветка и итоговые суммы.
 */
export function useInvoiceSection({ orgId, date, searchAll, bankTotal }: UseInvoiceSectionParams) {
  const { debouncedSearchText } = useSearch();
  const { highlightedInvoiceId, highlightRequestId, highlightDateCandidates, clearHighlight } =
    useInvoiceNavigation();
  const objects = useAccessibleObjects(orgId);
  const { data: invoices } = useInvoices(orgId, date);
  const displayInvoices = useMemo(
    () => (invoices ?? []).map((invoice) => normalizeInvoiceForDate(invoice, date)),
    [invoices, date],
  );
  const { data: searchResults, isLoading: searchResultsLoading } = useSearchInvoices(orgId);
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
    for (const file of orgFiles) {
      if (!map[file.invoice_id]) map[file.invoice_id] = [];
      map[file.invoice_id]!.push(file);
    }
    return map;
  }, [orgFiles]);

  const highlightedIds = useMemo(
    () =>
      highlightedInvoiceId
        ? Array.from(
            new Set([
              ...computeHighlightedIds(debouncedSearchText, searchResults, displayInvoices),
              highlightedInvoiceId,
            ]),
          )
        : computeHighlightedIds(debouncedSearchText, searchResults, displayInvoices),
    [debouncedSearchText, searchResults, displayInvoices, highlightedInvoiceId],
  );

  const { visibleObjects, hiddenObjects } = useMemo(() => {
    const visible: IAccountingObject[] = [];
    const hidden: IAccountingObject[] = [];
    for (const object of objects ?? []) {
      (object.is_active === false ? hidden : visible).push(object);
    }
    return { visibleObjects: visible, hiddenObjects: hidden };
  }, [objects]);

  const markedTotal = useMemo(() => {
    if (!displayInvoices || !paymentMarks) return 0;
    const visibleIds = new Set(visibleObjects.map((object) => object.id));
    const registryInvoices = displayInvoices.filter((invoice) =>
      visibleIds.has(normalizeRelationId(invoice.accounting_object_id)),
    );
    return registryInvoices.reduce((sum, invoice) => {
      const mark = paymentMarks.find((m) => m.invoice_id === invoice.id);
      if (!mark) return sum;
      return sum + (mark.amount ?? invoice.amount);
    }, 0);
  }, [displayInvoices, paymentMarks, visibleObjects]);

  const isOverBalance = markedTotal > bankTotal;

  const paidTodayTotal = useMemo(() => {
    if (!displayInvoices) return 0;
    const visibleIds = new Set(visibleObjects.map((object) => object.id));
    const registryInvoices = displayInvoices.filter(
      (invoice) =>
        invoice.paid &&
        invoice.paid_date === date &&
        visibleIds.has(normalizeRelationId(invoice.accounting_object_id)),
    );
    return registryInvoices.reduce((sum, invoice) => {
      if (invoice.payment_amounts?.length) {
        return sum + invoice.payment_amounts.reduce((s, a) => s + a, 0);
      }
      return sum + (invoice.paid_amount ?? invoice.amount);
    }, 0);
  }, [displayInvoices, date, visibleObjects]);

  const printInvoices = useMemo(() => {
    const visibleIds = new Set(visibleObjects.map((object) => object.id));
    return filterInvoices(
      displayInvoices.filter((invoice) =>
        visibleIds.has(normalizeRelationId(invoice.accounting_object_id)),
      ),
      paymentMarks,
      activeFilters,
    );
  }, [displayInvoices, paymentMarks, activeFilters, visibleObjects]);

  const grandTotal = useMemo(() => {
    return printInvoices.reduce((sum, invoice) => {
      if (!invoice.paid) return sum + invoice.amount;
      return sum;
    }, 0);
  }, [printInvoices]);

  const handleExportExcel = (objectId?: string) => {
    if (!currentOrg || !displayInvoices || !objects) return;
    const targetObjects = objectId ? objects.filter((obj) => obj.id === objectId) : visibleObjects;
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

  const objectIds = useMemo(() => objects?.map((object) => object.id) ?? [], [objects]);

  // Клик вне drawer сбрасывает подсветку строки и навигационную подсветку
  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.('.mantine-Drawer-root')) return;
      clearHighlight();
      document.querySelectorAll('.row-flash').forEach((el) => el.classList.remove('row-flash'));
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [clearHighlight]);

  return {
    debouncedSearchText,
    objects,
    visibleObjects,
    hiddenObjects,
    displayInvoices,
    searchResults,
    searchResultsLoading,
    searchAll,
    paymentMarks,
    permissions,
    usersMap,
    draftObjectId,
    setDraftObjectId,
    columnSettingsOpen,
    setColumnSettingsOpen,
    printingTarget,
    isPrinting,
    handlePrint,
    visibleColumns,
    handleColumnChange,
    filesByInvoice,
    highlightedIds,
    highlightedInvoiceId,
    highlightRequestId,
    highlightDateCandidates,
    markedTotal,
    isOverBalance,
    paidTodayTotal,
    printInvoices,
    grandTotal,
    activeFilters,
    setActiveFilters,
    handleExportExcel,
    objectIds,
  };
}
