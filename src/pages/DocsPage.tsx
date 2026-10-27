import { useEffect, useMemo, useState } from 'react';
  import { useDebouncedValue } from '@mantine/hooks';
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
  Anchor,
} from '@mantine/core';
import { IconChevronsDown, IconChevronsUp, IconFilter, IconCheck, IconPlus, IconSearch, IconSettings, IconX } from '@tabler/icons-react';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrg } from '@/shared/context/OrgContext';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useAccessibleObjects } from '@/shared/hooks/useAccessibleObjects';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { useUsers } from '@/shared/hooks/useUsers';
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
import { Link } from 'react-router-dom';

const PAGE_SIZE_OPTIONS = ['10', '15', '20', '30'];
const PAGE_SIZE_STORAGE_KEY = 'document-page-size';

export function DocsPage() {
  const { currentOrgId, organizationsLoading } = useOrg();
  const { user } = useAuth();
  const role = useCurrentUserRole(currentOrgId);
  const allObjectsQuery = useAccountingObjects(currentOrgId);
  const accessibleObjects = useAccessibleObjects(currentOrgId);
  const usersQuery = useUsers();

  const documentsQuery = useDocuments(currentOrgId, role, user?.id);
  const filesQuery = useAllDocumentFiles(currentOrgId);
  const commentsQuery = useAllDocumentComments(currentOrgId);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
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
  const [manualOpened, setManualOpened] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Organization switch replaces every persisted table setting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumns(loadDocumentColumns(currentOrgId));
    setSizing(loadDocumentColumnSizing(currentOrgId));
    setPages({});
    setSelectedDocumentId(null);
  }, [currentOrgId]);

  useEffect(() => {
    saveDocumentColumnSizing(currentOrgId, sizing);
  }, [currentOrgId, sizing]);

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  const objects = useMemo<IAccountingObject[]>(() => {
    if (!currentOrgId) return [];
    if (role === 'user') return accessibleObjects ?? [];
    return allObjectsQuery.data ?? [];
  }, [accessibleObjects, allObjectsQuery.data, currentOrgId, role]);

  const allowedObjectIds = useMemo(() => new Set(objects.map((object) => object.id)), [objects]);

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
      const isCompleted = isDocumentCompleted(document);
      if (showCompletedOnly) return isCompleted;
      if (!showCompletedOnly && isCompleted) return false;
      if (!allowedObjectIds.has(document.accounting_object_id)) return false;
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
  }, [documentsQuery.data, foldedQuery, matchingCommentIds, showCompletedOnly, allowedObjectIds]);

  const groups = useMemo<DocumentGroup[]>(() => {
    return objects
      .map((object) => {
        const objectDocuments = visibleDocuments.filter(
          (document) => document.accounting_object_id === object.id,
        );
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
  }, [visibleDocuments, objects, pageSize, pages]);

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
            <Anchor
              size="sm"
              component={Link}
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'black',
                fontWeight: 'bolder',
                fontSize: '16px',
              }}
            >
              Счета
            </Anchor>
            /
            <Title order={3}>Документы</Title>
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

          <Menu withinPortal>
            <Menu.Target>
              <Button
                size="compact-sm"
                variant="light"
                color="gray"
                style={{ padding: '0 20px' }}
                leftSection={<IconFilter size={16} />}
              >
                Фильтр
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={
                  showCompletedOnly ? (
                    <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                  ) : (
                    <Box w={16} />
                  )
                }
                color={showCompletedOnly ? 'blue' : undefined}
                onClick={() => {
                  setShowCompletedOnly(!showCompletedOnly);
                  setPages({});
                }}
              >
                Только отработанные
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item disabled c="dimmed">
                Другие фильтры (в разработке)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
