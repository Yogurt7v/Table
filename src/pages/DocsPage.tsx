import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useLocation } from 'react-router-dom';
import {
  ActionIcon,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Menu,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
  TextInput,
  Autocomplete,
  MultiSelect,
} from '@mantine/core';
import { BreadcrumbsNav } from '@/shared/components/BreadcrumbsNav';
import { DatePickerInput } from '@mantine/dates';
import { IconChevronsDown, IconChevronsUp, IconFilter, IconCheck, IconPlus, IconSearch, IconSettings, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { pb } from '@/api/client';
import type { IInvoice } from '@/shared/types';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrg } from '@/shared/context/OrgContext';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useAccessibleObjects } from '@/shared/hooks/useAccessibleObjects';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { useUsers } from '@/shared/hooks/useUsers';
import { useOrgCounterparties } from '@/features/mail/useOrgCounterparties';
import { localDateToDateKey } from '@/features/mail/mail-date';
import {
  useAllDocumentComments,
  useAllDocumentFiles,
  useDocumentCommentSearch,
  useDocuments,
} from '@/shared/hooks/useDocuments';
import { DocumentColumnSettingsModal } from '@/features/documents/DocumentColumnSettingsModal';
import { DocumentCardModal } from '@/features/documents/DocumentCardModal';
import { DocumentsTable, type DocumentGroup } from '@/features/documents/DocumentsTable';
import { ManualDocumentModal } from '@/features/documents/ManualDocumentModal';
import {
  isDocumentCompleted,
  loadDocumentColumnSizing,
  loadDocumentColumns,
  saveDocumentColumnSizing,
  saveDocumentColumns,
  type DocumentColumnSizing,
} from '@/features/documents/document-columns';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';
import type {
  DocumentColumnId,
  IAccountingObject,
  IDocument,
  IDocumentComment,
  IDocumentFile,
} from '@/shared/types';

type DocumentStatusFilter = 'in_progress' | 'provided' | 'confirmed';

const PAGE_SIZE_OPTIONS = ['10', '15', '20', '30'];
const PAGE_SIZE_STORAGE_KEY = 'document-page-size';

export function DocsPage() {
  const { currentOrgId, organizationsLoading } = useOrg();
  const { user } = useAuth();
  const role = useCurrentUserRole(currentOrgId);
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
    return stored && PAGE_SIZE_OPTIONS.includes(stored) ? Number(stored) : 15;
  });
  const [pages, setPages] = useState<Record<string, number>>({});
  const [columns, setColumns] = useState<DocumentColumnId[]>(() => loadDocumentColumns(currentOrgId));
  const [sizing, setSizing] = useState<DocumentColumnSizing>(() =>
    loadDocumentColumnSizing(currentOrgId),
  );
  const [columnsOpened, setColumnsOpened] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
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

  // Callback-ref подсветки: вызывается React ровно в момент монтирования
  // подсвеченной строки в DOM, поэтому скролл не может обогнать рендер
  // (раньше object-ref читался в эффекте до загрузки данных и был null).
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

  // Подсветка строки при переходе из уведомления: NotificationsBell ведёт на /docs
  // с `state: { documentId }`. Ждём загрузки документов, сбрасываем фильтры,
  // вычисляем группу и страницу документа, раскрываем группу — строку монтирует
  // callback-ref (handleHighlightRowRef), он же скроллит и запускает таймер
  // 2.4s анимации (см. index.css `.document-row--highlight`). Все setState
  // отложены в queueMicrotask: это инициализация, а не реакция на пропсы —
  // иначе `react-hooks/set-state-in-effect` ругается на вызов в теле эффекта.
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
      // Фолбэк: если строка так и не смонтировалась (документ не найден,
      // отфильтрован по роли, в архиве) — снимаем подсветку и не копим таймеры.
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
        ? invoiceDateById[document.source_invoice_id] ?? ''
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

  const handleOpenDocument = (document: IDocument) => {
    setSelectedDocumentId(document.id);
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

  if (!currentOrgId) {
    if (organizationsLoading) {
      return (
        <Container py="xl">
          <Loader />
        </Container>
      );
    }
    return (
      <Container size="sm" py="xl">
        <Text>Вас не добавили ни в одну организацию.</Text>
      </Container>
    );
  }

  if (role === 'guest') {
    return (
      <Container size="sm" py="xl">
        <Title order={3} ta="center" c="red">
          Доступ запрещён
        </Title>
        <Text ta="center" mt="sm">
          У вас нет прав для просмотра документов.
        </Text>
      </Container>
    );
  }

  const canCreate = role === 'admin' || role === 'moderator';
  const isLoading = documentsQuery.isLoading || allObjectsQuery.isLoading;

  return (
    <Container size="fluid" py={{ base: 'xs', sm: 'md' }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Group gap="sm">
            <BreadcrumbsNav />
            <Tooltip label="Настройка колонок">
              <ActionIcon
                size="sm"
                color='grey'
                variant="subtle"
                aria-label="Настройка колонок"
                onClick={() => setColumnsOpened(true)}
              >
                <IconSettings size={20} />
              </ActionIcon>
            </Tooltip>
            <Text size="sm" c="dimmed">
              {visibleDocuments.length}
            </Text>
          </Group>

        </Group>

        <Group gap="xs" wrap="wrap" onMouseDown={(e) => e.stopPropagation()}>
          <DatePickerInput
            type="range"
            size="xs"
            label="Период оплаты"
            placeholder="Период"
            aria-label="Период оплаты"
            clearable
            closeOnChange
            allowSingleDateInRange
            valueFormat="DD.MM.YYYY"
            labelSeparator=" – "
            leftSection={<IconFilter size={14} />}
            leftSectionPointerEvents="none"
            value={paymentDateRange}
            popoverProps={{ classNames: { dropdown: 'docs-period-dropdown' } }}
            onChange={(value) => {
              setPaymentDateRange([value[0] ?? null, value[1] ?? null]);
              setPages({});
            }}
          />
          <DatePickerInput
            type="range"
            size="xs"
            label="Период счёта"
            placeholder="Период"
            aria-label="Период счёта"
            clearable
            closeOnChange
            allowSingleDateInRange
            valueFormat="DD.MM.YYYY"
            labelSeparator=" – "
            leftSection={<IconFilter size={14} />}
            leftSectionPointerEvents="none"
            value={invoiceDateRange}
            popoverProps={{ classNames: { dropdown: 'docs-period-dropdown' } }}
            onChange={(value) => {
              setInvoiceDateRange([value[0] ?? null, value[1] ?? null]);
              setPages({});
            }}
          />
        </Group>
        <Group justify="space-between" wrap="wrap">
          <TextInput
            w={{ base: '100%', sm: 520 }}
            leftSection={<IconSearch size={16} />}
            rightSection={
              search ? (
                <ActionIcon variant="subtle" aria-label="Очистить поиск" onClick={handleClearSearch}>
                  <IconX size={14} />
                </ActionIcon>
              ) : null
            }
            placeholder="Поиск по документам и комментариям"
            value={search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.currentTarget.value)}
            aria-label="Поиск документов"
          />
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              На странице
            </Text>
            <Select
              w={80}
              size="sm"
              data={PAGE_SIZE_OPTIONS}
              value={String(pageSize)}
              onChange={(value) => {
                if (!value) return;
                setPageSize(Number(value));
                setPages({});
              }}
              allowDeselect={false}
              aria-label="Размер страницы"
            />
          </Group>
        </Group>

        <Group gap="xs" wrap="wrap">

          <div ref={filterRef}>
            <Menu
              shadow="md"
              width={280}
              closeOnItemClick={false}
              opened={filterOpened}
              onChange={setFilterOpened}
            >
            <Menu.Target>
              <Button
                size="compact-sm"
                variant="light"
                color={activeFilterCount > 0 ? 'blue' : 'gray'}
                style={{ padding: '0 20px' }}
                leftSection={<IconFilter size={16} />}
              >
                {activeFilterCount > 0 ? `Фильтр (${activeFilterCount})` : 'Фильтр'}
              </Button>
            </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Сортировка</Menu.Label>
                <Menu.Item
                  closeMenuOnClick
                  leftSection={
                    sortOrder === 'new' ? (
                      <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                    ) : (
                      <Box w={16} />
                    )
                  }
                  color={sortOrder === 'new' ? 'blue' : undefined}
                  onClick={() => {
                    setSortOrder(sortOrder === 'new' ? null : 'new');
                    setPages({});
                  }}
                >
                  Сначала новые
                </Menu.Item>
                <Menu.Item
                  closeMenuOnClick
                  leftSection={
                    sortOrder === 'old' ? (
                      <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                    ) : (
                      <Box w={16} />
                    )
                  }
                  color={sortOrder === 'old' ? 'blue' : undefined}
                  onClick={() => {
                    setSortOrder(sortOrder === 'old' ? null : 'old');
                    setPages({});
                  }}
                >
                  Сначала старые
                </Menu.Item>
                <Menu.Divider />
                <Menu.Label>Статус</Menu.Label>
                <Menu.Item
                  closeMenuOnClick
                  leftSection={
                    statusFilter === 'in_progress' ? (
                      <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                    ) : (
                      <Box w={16} />
                    )
                  }
                  color={statusFilter === 'in_progress' ? 'blue' : undefined}
                  onClick={() => {
                    setStatusFilter(statusFilter === 'in_progress' ? null : 'in_progress');
                    setPages({});
                  }}
                >
                  В работе
                </Menu.Item>
                <Menu.Item
                  closeMenuOnClick
                  leftSection={
                    statusFilter === 'provided' ? (
                      <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                    ) : (
                      <Box w={16} />
                    )
                  }
                  color={statusFilter === 'provided' ? 'blue' : undefined}
                  onClick={() => {
                    setStatusFilter(statusFilter === 'provided' ? null : 'provided');
                    setPages({});
                  }}
                >
                  Предоставлен
                </Menu.Item>
                <Menu.Item
                  closeMenuOnClick
                  leftSection={
                    statusFilter === 'confirmed' ? (
                      <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                    ) : (
                      <Box w={16} />
                    )
                  }
                  color={statusFilter === 'confirmed' ? 'blue' : undefined}
                  onClick={() => {
                    setStatusFilter(statusFilter === 'confirmed' ? null : 'confirmed');
                    setPages({});
                  }}
                >
                  Подтверждён
                </Menu.Item>
                <Menu.Divider />

              <Box p="xs">
                <Autocomplete
                  size="xs"
                  label="Контрагент"
                  placeholder="Поиск по контрагенту"
                  data={counterpartyOptions}
                  value={filterCounterparty}
                  onChange={(value) => {
                    setFilterCounterparty(value);
                    setPages({});
                  }}
                  leftSection={<IconSearch size={14} />}
                  rightSection={
                    filterCounterparty ? (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="gray"
                        aria-label="Очистить контрагента"
                        onClick={() => {
                          setFilterCounterparty('');
                          setPages({});
                        }}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    ) : null
                  }
                  comboboxProps={{ withinPortal: false }}
                />
              </Box>

              {objects.length > 0 && (
                <>
                  <Menu.Divider />
                  <Menu.Label>Объект</Menu.Label>
                  <Box px="xs" pb={4}>
                    <MultiSelect
                      size="xs"
                      placeholder="Выберите объекты"
                      aria-label="Объект"
                      data={objectOptions}
                      value={filterObjectIds}
                      onChange={(value) => {
                        setFilterObjectIds(value);
                        setPages({});
                      }}
                      comboboxProps={{ withinPortal: false }}
                      hidePickedOptions
                    />
                  </Box>
                  <Menu.Item
                    leftSection={
                      filterObjectIds.length === 0 ? (
                        <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                      ) : (
                        <Box w={16} />
                      )
                    }
                    color={filterObjectIds.length === 0 ? 'blue' : undefined}
                    onClick={() => {
                      setFilterObjectIds([]);
                      setPages({});
                    }}
                  >
                    Все объекты
                  </Menu.Item>
                </>
              )}
              <Menu.Divider />
              <Menu.Item
                color="red"
                disabled={activeFilterCount === 0}
                leftSection={<IconX size={16} />}
                closeMenuOnClick
                onClick={resetFilters}
              >
                Сбросить
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          </div>
          <Button
            size="compact-sm"
            variant="light"
            color="gray"
            flex="1"
            rightSection={collapsedIds.size === groups.length ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
            onClick={toggleCollapseAll}
            leftSection={collapsedIds.size === groups.length ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
          >
            {collapsedIds.size === groups.length ? 'Развернуть' : 'Свернуть'}
          </Button>

          {canCreate && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setManualOpened(true)}>
              Добавить документ
            </Button>
          )}
        </Group>

        {isLoading ? (
          <Loader />
        ) : (
          <DocumentsTable
            groups={groups}
            visibleColumns={columns}
            sizing={sizing}
            filesByDocument={filesByDocument}
            commentsByDocument={commentsByDocument}
            pageSize={pageSize}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
            onPageChange={(objectId, page) =>
              setPages((current) => ({ ...current, [objectId]: page }))
            }
            onWidthChange={(columnId, width) =>
              setSizing((current) => ({ ...current, [columnId]: width }))
            }
            onWidthCommit={() => saveDocumentColumnSizing(currentOrgId, sizing)}
            onOpenDocument={handleOpenDocument}
            highlightDocumentId={highlightDocumentId}
              highlightRowRef={handleHighlightRowRef}
          />
        )}
      </Stack>

      {columnsOpened && (
        <DocumentColumnSettingsModal
          opened
          value={columns}
          onChange={(next) => {
            setColumns(next);
            saveDocumentColumns(currentOrgId, next);
          }}
          onClose={() => setColumnsOpened(false)}
        />
      )}

      <DocumentCardModal
        documentId={selectedDocumentId}
        opened={!!selectedDocumentId}
        onClose={() => setSelectedDocumentId(null)}
        organizationId={currentOrgId}
        role={role}
        currentUserId={user?.id}
        objects={objects}
        users={usersQuery.data ?? []}
      />

      {canCreate && manualOpened && (
        <ManualDocumentModal
          opened
          onClose={() => setManualOpened(false)}
          organizationId={currentOrgId}
          role={role}
          currentUserId={user?.id}
          objects={objects}
          users={usersQuery.data ?? []}
        />
      )}
    </Container>
  );
}
