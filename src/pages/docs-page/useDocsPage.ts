import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { pb } from '@/api/client';
import type {
  DocumentColumnId,
  IAccountingObject,
  IDocument,
  IDocumentComment,
  IDocumentFile,
  IInvoice,
} from '@/shared/types';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrg } from '@/shared/context/OrgContext';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useAccessibleObjects } from '@/shared/hooks/useAccessibleObjects';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { useUsers } from '@/shared/hooks/useUsers';
import { useDocumentPermissions } from '@/shared/hooks/useDocumentPermissions';
import { useOrgCounterparties } from '@/features/mail/useOrgCounterparties';
import { localDateToDateKey } from '@/features/mail/mail-date';
import {
  useAllDocumentComments,
  useAllDocumentFiles,
  useDocumentCommentSearch,
  useDocuments,
} from '@/shared/hooks/useDocuments';
import type { DocumentGroup } from '@/features/documents/DocumentsTable';
import {
  isDocumentCompleted,
  loadDocumentColumnSizing,
  loadDocumentColumns,
  saveDocumentColumnSizing,
  type DocumentColumnSizing,
} from '@/features/documents/document-columns';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';
import {
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_STORAGE_KEY,
  type DocumentStatusFilter,
} from './docs-page-types';

/** Хук-контроллер страницы документов: данные, фильтры, состояние таблицы и модалок. */
export function useDocsPage() {
  const { currentOrgId, organizationsLoading } = useOrg();
  const { user } = useAuth();
  const role = useCurrentUserRole(currentOrgId);
  const documentPermissions = useDocumentPermissions(currentOrgId);
  const location = useLocation();
  const allObjectsQuery = useAccountingObjects(currentOrgId);
  const accessibleObjects = useAccessibleObjects(currentOrgId);
  const usersQuery = useUsers();
  const { counterpartyOptions } = useOrgCounterparties(currentOrgId);

  const documentsQuery = useDocuments(currentOrgId, role, user?.id);
  const filesQuery = useAllDocumentFiles(currentOrgId);
  const commentsQuery = useAllDocumentComments(currentOrgId);

  const invoiceDatesQuery = useQuery({
    queryKey: ['invoiceDates', currentOrgId],
    queryFn: async () => {
      const list = await pb.collection('invoices').getFullList<IInvoice>({
        filter: `organization_id = "${currentOrgId}"`,
        fields: 'id,date',
        skipTotal: true,
      });
      const map: Record<string, string> = {};
      for (const invoice of list) {
        if (invoice.id && invoice.date) map[invoice.id] = invoice.date.slice(0, 10);
      }
      return map;
    },
    enabled: !!currentOrgId,
    staleTime: 5 * 60_000,
  });
  const invoiceDateById = useMemo(() => invoiceDatesQuery.data ?? {}, [invoiceDatesQuery.data]);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [statusFilter, setStatusFilter] = useState<DocumentStatusFilter | null>(null);
  const [sortOrder, setSortOrder] = useState<'new' | 'old' | null>(null);
  const [filterObjectIds, setFilterObjectIds] = useState<string[]>([]);
  const [filterPaymentDate, setFilterPaymentDate] = useState<string | null>(null);
  const [filterCounterparty, setFilterCounterparty] = useState('');
  const [paymentDateRange, setPaymentDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);
  const [invoiceDateRange, setInvoiceDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);
  const [pageSize, setPageSize] = useState(() => {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    return stored && PAGE_SIZE_OPTIONS.includes(stored as (typeof PAGE_SIZE_OPTIONS)[number])
      ? Number(stored)
      : 15;
  });
  const [pages, setPages] = useState<Record<string, number>>({});
  const [columns, setColumns] = useState<DocumentColumnId[]>(() =>
    loadDocumentColumns(currentOrgId),
  );
  const [sizing, setSizing] = useState<DocumentColumnSizing>(() =>
    loadDocumentColumnSizing(currentOrgId),
  );
  const [columnsOpened, setColumnsOpened] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'document' | 'files' | 'comments' | 'history'>(
    'document',
  );
  const [highlightDocumentId, setHighlightDocumentId] = useState<string | null>(null);
  const [manualOpened, setManualOpened] = useState(false);
  const [filterOpened, setFilterOpened] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const highlightDisplayTimerRef = useRef<number | null>(null);
  const highlightFallbackTimerRef = useRef<number | null>(null);
  const clearHighlightTimers = useCallback(() => {
    if (highlightDisplayTimerRef.current != null) {
      window.clearTimeout(highlightDisplayTimerRef.current);
    }
    if (highlightFallbackTimerRef.current != null) {
      window.clearTimeout(highlightFallbackTimerRef.current);
    }
    highlightDisplayTimerRef.current = null;
    highlightFallbackTimerRef.current = null;
  }, []);

  const handleHighlightRowRef = useCallback((node: HTMLTableRowElement | null) => {
    if (!node) return;
    if (highlightFallbackTimerRef.current != null) {
      window.clearTimeout(highlightFallbackTimerRef.current);
      highlightFallbackTimerRef.current = null;
    }
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (highlightDisplayTimerRef.current != null) {
      window.clearTimeout(highlightDisplayTimerRef.current);
    }
    highlightDisplayTimerRef.current = window.setTimeout(() => setHighlightDocumentId(null), 2400);
  }, []);

  useEffect(() => () => clearHighlightTimers(), [clearHighlightTimers]);

  useEffect(() => {
    // Organization switch replaces every persisted table setting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumns(loadDocumentColumns(currentOrgId));
    setSizing(loadDocumentColumnSizing(currentOrgId));
    setPages({});
    setSelectedDocumentId(null);
    setHighlightDocumentId(null);
    setFilterObjectIds([]);
    setFilterPaymentDate(null);
    setFilterCounterparty('');
    setPaymentDateRange([null, null]);
    setInvoiceDateRange([null, null]);
    clearHighlightTimers();
  }, [currentOrgId, clearHighlightTimers]);

  const handledLocationKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!documentsQuery.isSuccess) return;
    if (handledLocationKeyRef.current === location.key) return;
    handledLocationKeyRef.current = location.key;
    const state = (location.state ?? {}) as { documentId?: string };
    const documentId = state.documentId;
    if (!documentId) {
      queueMicrotask(() => setHighlightDocumentId(null));
      return;
    }
    queueMicrotask(() => {
      setSearch('');
      setStatusFilter(null);
      setFilterObjectIds([]);
      setFilterPaymentDate(null);
      setFilterCounterparty('');
      setPaymentDateRange([null, null]);
      setInvoiceDateRange([null, null]);
      const base = documentsQuery.data ?? [];
      const doc = base.find((d) => d.id === documentId);
      if (doc) {
        const objectId = doc.accounting_object_id;
        const groupDocs = base.filter((d) => d.accounting_object_id === objectId);
        if (sortOrder === 'new') {
          groupDocs.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''));
        } else if (sortOrder === 'old') {
          groupDocs.sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''));
        }
        const index = groupDocs.findIndex((d) => d.id === documentId);
        if (index >= 0) {
          const page = Math.floor(index / pageSize) + 1;
          setPages((prev) => ({ ...prev, [objectId]: page }));
        }
        setCollapsedIds((prev) => {
          if (!prev.has(objectId)) return prev;
          const next = new Set(prev);
          next.delete(objectId);
          return next;
        });
      }
      setHighlightDocumentId(documentId);
      if (highlightFallbackTimerRef.current != null) {
        window.clearTimeout(highlightFallbackTimerRef.current);
      }
      highlightFallbackTimerRef.current = window.setTimeout(
        () => setHighlightDocumentId(null),
        5000,
      );
    });
  }, [
    location.state,
    location.key,
    documentsQuery.isSuccess,
    documentsQuery.data,
    pageSize,
    sortOrder,
  ]);

  useEffect(() => {
    saveDocumentColumnSizing(currentOrgId, sizing);
  }, [currentOrgId, sizing]);

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  const objects = useMemo<IAccountingObject[]>(() => {
    if (!currentOrgId) return [];
    return [...(accessibleObjects ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [accessibleObjects, currentOrgId]);

  const objectOptions = useMemo(
    () => objects.map((object) => ({ value: object.id, label: object.name })),
    [objects],
  );

  const allowedObjectIds = useMemo(() => new Set(objects.map((object) => object.id)), [objects]);

  const activeFilterCount =
    (filterObjectIds.length > 0 ? 1 : 0) +
    (filterPaymentDate ? 1 : 0) +
    (filterCounterparty.trim() ? 1 : 0) +
    (paymentDateRange[0] || paymentDateRange[1] ? 1 : 0) +
    (invoiceDateRange[0] || invoiceDateRange[1] ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (sortOrder ? 1 : 0);

  const resetFilters = () => {
    setStatusFilter(null);
    setSortOrder(null);
    setFilterObjectIds([]);
    setFilterPaymentDate(null);
    setFilterCounterparty('');
    setPaymentDateRange([null, null]);
    setInvoiceDateRange([null, null]);
    setPages({});
  };

  const filesData = filesQuery.data;
  const commentsData = commentsQuery.data;

  const filesByDocument = useMemo(() => {
    const map: Record<string, IDocumentFile[]> = {};
    for (const file of filesData ?? []) {
      (map[file.document_id] ??= []).push(file);
    }
    return map;
  }, [filesData]);

  const commentsByDocument = useMemo(() => {
    const map: Record<string, IDocumentComment[]> = {};
    for (const comment of commentsData ?? []) {
      (map[comment.document_id] ??= []).push(comment);
    }
    return map;
  }, [commentsData]);

  const foldedQuery = foldSearchText(debouncedSearch);
  const foldedCounterparty = foldSearchText(filterCounterparty);
  const commentSearchQuery = useDocumentCommentSearch(
    currentOrgId,
    debouncedSearch,
    debouncedSearch.trim().length > 0,
  );
  const matchingCommentIds = useMemo(
    () => new Set(commentSearchQuery.data ?? []),
    [commentSearchQuery.data],
  );

  const visibleDocuments = useMemo(() => {
    return (documentsQuery.data ?? []).filter((document) => {
      if (document.is_deleted) return false;
      if (statusFilter) {
        if (statusFilter === 'in_progress') {
          if (document.provided || document.confirmed) return false;
        } else if (statusFilter === 'provided') {
          if (!document.provided || document.confirmed) return false;
        } else if (statusFilter === 'confirmed') {
          if (!isDocumentCompleted(document)) return false;
        }
      }
      if (!allowedObjectIds.has(document.accounting_object_id)) return false;
      if (filterObjectIds.length > 0 && !filterObjectIds.includes(document.accounting_object_id)) {
        return false;
      }
      if (filterPaymentDate && document.payment_date !== filterPaymentDate) return false;
      if (
        foldedCounterparty &&
        !foldSearchText(document.counterparty).includes(foldedCounterparty)
      ) {
        return false;
      }
      const paymentKey = document.payment_date ? document.payment_date.slice(0, 10) : '';
      const paymentFrom = localDateToDateKey(paymentDateRange[0]);
      const paymentTo = localDateToDateKey(paymentDateRange[1]);
      if (paymentFrom && paymentKey < paymentFrom) return false;
      if (paymentTo && paymentKey > paymentTo) return false;
      const invoiceKey = document.source_invoice_id
        ? (invoiceDateById[document.source_invoice_id] ?? '')
        : '';
      const invoiceFrom = localDateToDateKey(invoiceDateRange[0]);
      const invoiceTo = localDateToDateKey(invoiceDateRange[1]);
      if ((invoiceFrom || invoiceTo) && !invoiceKey) return false;
      if (invoiceFrom && invoiceKey < invoiceFrom) return false;
      if (invoiceTo && invoiceKey > invoiceTo) return false;
      if (!foldedQuery) return true;
      return (
        matchesFolded(
          [
            document.counterparty,
            document.purpose,
            document.contract_no,
            document.invoice_no,
            document.amount != null ? String(document.amount) : '',
          ],
          foldedQuery,
        ) || matchingCommentIds.has(document.id)
      );
    });
  }, [
    documentsQuery.data,
    foldedQuery,
    foldedCounterparty,
    matchingCommentIds,
    statusFilter,
    allowedObjectIds,
    filterObjectIds,
    filterPaymentDate,
    paymentDateRange,
    invoiceDateRange,
    invoiceDateById,
  ]);

  const groups = useMemo<DocumentGroup[]>(() => {
    return objects
      .map((object) => {
        const objectDocuments = [...visibleDocuments]
          .filter((document) => document.accounting_object_id === object.id)
          .sort((a, b) => {
            if (sortOrder === 'new') {
              return (b.created ?? '').localeCompare(a.created ?? '');
            }
            if (sortOrder === 'old') {
              return (a.created ?? '').localeCompare(b.created ?? '');
            }
            return 0;
          });
        const totalPages = Math.max(1, Math.ceil(objectDocuments.length / pageSize));
        const page = Math.min(pages[object.id] ?? 1, totalPages);
        return {
          objectId: object.id,
          objectName: object.name,
          total: objectDocuments.length,
          page,
          documents: objectDocuments.slice((page - 1) * pageSize, page * pageSize),
        };
      })
      .filter((group) => group.total > 0);
  }, [visibleDocuments, objects, pageSize, pages, sortOrder]);

  const handleClearSearch = () => {
    setSearch('');
    setPages({});
  };

  const handleOpenDocument = (
    document: IDocument,
    tab: 'document' | 'files' | 'comments' | 'history' = 'document',
  ) => {
    setSelectedDocumentId(document.id);
    setSelectedTab(tab);
  };

  const toggleCollapse = (objectId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(objectId)) next.delete(objectId);
      else next.add(objectId);
      return next;
    });
  };

  const toggleCollapseAll = () => {
    setCollapsedIds((current) => {
      if (current.size === groups.length) return new Set();
      return new Set(groups.map((g) => g.objectId));
    });
  };

  const canCreate = role === 'admin' || role === 'moderator' || role === 'user';
  const isLoading = documentsQuery.isLoading || allObjectsQuery.isLoading;

  return {
    currentOrgId,
    organizationsLoading,
    user,
    role,
    documentPermissions,
    usersQuery,
    counterpartyOptions,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortOrder,
    setSortOrder,
    filterObjectIds,
    setFilterObjectIds,
    filterPaymentDate,
    setFilterPaymentDate,
    filterCounterparty,
    setFilterCounterparty,
    paymentDateRange,
    setPaymentDateRange,
    invoiceDateRange,
    setInvoiceDateRange,
    pageSize,
    setPageSize,
    pages,
    setPages,
    columns,
    setColumns,
    sizing,
    setSizing,
    columnsOpened,
    setColumnsOpened,
    selectedDocumentId,
    setSelectedDocumentId,
    selectedTab,
    setSelectedTab,
    highlightDocumentId,
    manualOpened,
    setManualOpened,
    filterOpened,
    setFilterOpened,
    filterRef,
    collapsedIds,
    handleHighlightRowRef,
    objects,
    objectOptions,
    activeFilterCount,
    resetFilters,
    filesByDocument,
    commentsByDocument,
    visibleDocuments,
    groups,
    handleClearSearch,
    handleOpenDocument,
    toggleCollapse,
    toggleCollapseAll,
    canCreate,
    isLoading,
  };
}
