import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { pb } from '@/api/client';
import type { DocumentColumnId, IDocument, IInvoice } from '@/shared/types';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrg } from '@/shared/context/OrgContext';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useAccessibleObjects } from '@/features/accounts/hooks/useAccessibleObjects';
import { useAccountingObjects } from '@/features/accounts/hooks/useAccountingObjects';
import { useUsers } from '@/shared/hooks/useUsers';
import { useDocumentPermissions } from '@/features/documents/hooks/useDocumentPermissions';
import { useOrgCounterparties } from '@/features/mail/useOrgCounterparties';
import {
  useAllDocumentComments,
  useAllDocumentFiles,
  useDocumentCommentSearch,
  useDocuments,
} from '@/features/documents/hooks/useDocuments';
import {
  loadDocumentColumnSizing,
  loadDocumentColumns,
  saveDocumentColumnSizing,
  type DocumentColumnSizing,
} from '@/features/documents/model/document-columns';
import {
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_STORAGE_KEY,
  type DocumentStatusFilter,
} from './docs-page-types';
import { useDocsPageDerived } from './useDocsPageDerived';
import { useDocsPageHighlight } from './useDocsPageHighlight';
import { useDocsPageLocationFocus } from './useDocsPageLocationFocus';

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
  const [manualOpened, setManualOpened] = useState(false);
  const [filterOpened, setFilterOpened] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const {
    highlightDocumentId,
    setHighlightDocumentId,
    handleHighlightRowRef,
    resetHighlight,
    scheduleHighlightFallback,
  } = useDocsPageHighlight();

  useEffect(() => {
    // При смене организации сбрасываем сохранённые настройки таблицы и локальное состояние страницы.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumns(loadDocumentColumns(currentOrgId));
    setSizing(loadDocumentColumnSizing(currentOrgId));
    setPages({});
    setSelectedDocumentId(null);
    setFilterObjectIds([]);
    setFilterPaymentDate(null);
    setFilterCounterparty('');
    setPaymentDateRange([null, null]);
    setInvoiceDateRange([null, null]);
    resetHighlight();
  }, [currentOrgId, resetHighlight]);

  useDocsPageLocationFocus({
    location,
    documents: documentsQuery.data,
    isDocumentsLoaded: documentsQuery.isSuccess,
    pageSize,
    sortOrder,
    setSearch,
    setStatusFilter,
    setFilterObjectIds,
    setFilterPaymentDate,
    setFilterCounterparty,
    setPaymentDateRange,
    setInvoiceDateRange,
    setPages,
    setCollapsedIds,
    setHighlightDocumentId,
    scheduleHighlightFallback,
  });

  useEffect(() => {
    saveDocumentColumnSizing(currentOrgId, sizing);
  }, [currentOrgId, sizing]);

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  const commentSearchQuery = useDocumentCommentSearch(
    currentOrgId,
    debouncedSearch,
    debouncedSearch.trim().length > 0,
  );
  const matchingCommentIds = useMemo(
    () => new Set(commentSearchQuery.data ?? []),
    [commentSearchQuery.data],
  );

  const {
    objects,
    objectOptions,
    activeFilterCount,
    resetFilters,
    filesByDocument,
    commentsByDocument,
    visibleDocuments,
    groups,
  } = useDocsPageDerived({
    currentOrgId,
    accessibleObjects,
    documentsData: documentsQuery.data,
    filesData: filesQuery.data,
    commentsData: commentsQuery.data,
    debouncedSearch,
    filterCounterparty,
    matchingCommentIds,
    statusFilter,
    filterObjectIds,
    filterPaymentDate,
    paymentDateRange,
    invoiceDateRange,
    invoiceDateById,
    sortOrder,
    pageSize,
    pages,
    setStatusFilter,
    setSortOrder,
    setFilterObjectIds,
    setFilterPaymentDate,
    setFilterCounterparty,
    setPaymentDateRange,
    setInvoiceDateRange,
    setPages,
  });

  /** Очищает поиск и сбрасывает пагинацию по объектам. */
  const handleClearSearch = () => {
    setSearch('');
    setPages({});
  };

  /** Открывает карточку документа на выбранной вкладке. */
  const handleOpenDocument = (
    document: IDocument,
    tab: 'document' | 'files' | 'comments' | 'history' = 'document',
  ) => {
    setSelectedDocumentId(document.id);
    setSelectedTab(tab);
  };

  /** Переключает свёрнутость одной группы объектов. */
  const toggleCollapse = (objectId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(objectId)) next.delete(objectId);
      else next.add(objectId);
      return next;
    });
  };

  /** Сворачивает или разворачивает все группы объектов. */
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
