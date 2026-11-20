import {
  ActionIcon,
  Center,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconDatabaseOff, IconSettings } from '@tabler/icons-react';

import { BreadcrumbsNav } from '@/shared/components/BreadcrumbsNav';
import { DocumentColumnSettingsModal } from '@/features/documents/DocumentColumnSettingsModal';
import { DocumentCardModal } from '@/features/documents/DocumentCardModal';
import { DocumentsTable } from '@/features/documents/DocumentsTable';
import { ManualDocumentModal } from '@/features/documents/ManualDocumentModal';
import {
  saveDocumentColumnSizing,
  saveDocumentColumns,
} from '@/features/documents/document-columns';
import { DocsPageToolbar } from './docs-page/DocsPageToolbar';
import { useDocsPage } from '@/features/documents/hooks/use-docs-page/useDocsPage';

/** Страница документов: фильтры, сгруппированная таблица и модальные окна. */
export function DocsPage() {
  const page = useDocsPage();

  // Организация не выбрана: показываем загрузку или заглушку «без организации»
  if (!page.currentOrgId) {
    if (page.organizationsLoading) {
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

  // Гостю доступ к документам запрещён
  if (page.role === 'guest') {
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

  // Нет прав просмотра базы документов
  if (!page.documentPermissions.canView) {
    return (
      <Container size="sm" py="xl">
        <Center>
          <ThemeIcon size={56} radius="xl" variant="light" color="gray">
            <IconDatabaseOff size={28} />
          </ThemeIcon>
        </Center>
        <Text ta="center">Нет доступа к базе</Text>
      </Container>
    );
  }

  return (
    <Container size="fluid" py={{ base: 'xs', sm: 'md' }}>
      <Stack gap="md">
        {/* Заголовок страницы, хлебные крошки и настройка колонок */}
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Group gap="sm">
            <BreadcrumbsNav />
            <Tooltip label="Настройка колонок">
              <ActionIcon
                size="sm"
                color="grey"
                variant="subtle"
                aria-label="Настройка колонок"
                onClick={() => page.setColumnsOpened(true)}
              >
                <IconSettings size={20} />
              </ActionIcon>
            </Tooltip>
            <Text size="sm" c="dimmed">
              {page.visibleDocuments.length}
            </Text>
          </Group>
        </Group>

        <DocsPageToolbar
          paymentDateRange={page.paymentDateRange}
          invoiceDateRange={page.invoiceDateRange}
          onPaymentDateRangeChange={(value) => page.setPaymentDateRange(value)}
          onInvoiceDateRangeChange={(value) => page.setInvoiceDateRange(value)}
          search={page.search}
          onSearchChange={page.setSearch}
          onClearSearch={page.handleClearSearch}
          pageSize={page.pageSize}
          onPageSizeChange={page.setPageSize}
          filterRef={page.filterRef}
          filterOpened={page.filterOpened}
          setFilterOpened={page.setFilterOpened}
          activeFilterCount={page.activeFilterCount}
          sortOrder={page.sortOrder}
          setSortOrder={page.setSortOrder}
          statusFilter={page.statusFilter}
          setStatusFilter={page.setStatusFilter}
          counterpartyOptions={page.counterpartyOptions}
          filterCounterparty={page.filterCounterparty}
          setFilterCounterparty={page.setFilterCounterparty}
          objects={page.objects}
          objectOptions={page.objectOptions}
          filterObjectIds={page.filterObjectIds}
          setFilterObjectIds={page.setFilterObjectIds}
          resetFilters={page.resetFilters}
          collapsedAll={page.collapsedIds.size === page.groups.length}
          onToggleCollapseAll={page.toggleCollapseAll}
          canCreate={page.canCreate}
          onCreate={() => page.setManualOpened(true)}
          setPages={page.setPages}
        />

        {/* Таблица документов по объектам или загрузка */}
        {page.isLoading ? (
          <Loader />
        ) : (
          <DocumentsTable
            groups={page.groups}
            visibleColumns={page.columns}
            sizing={page.sizing}
            filesByDocument={page.filesByDocument}
            commentsByDocument={page.commentsByDocument}
            pageSize={page.pageSize}
            collapsedIds={page.collapsedIds}
            onToggleCollapse={page.toggleCollapse}
            onPageChange={(objectId, p) =>
              page.setPages((current) => ({ ...current, [objectId]: p }))
            }
            onWidthChange={(columnId, width) =>
              page.setSizing((current) => ({ ...current, [columnId]: width }))
            }
            onWidthCommit={() => saveDocumentColumnSizing(page.currentOrgId, page.sizing)}
            onOpenDocument={page.handleOpenDocument}
            highlightDocumentId={page.highlightDocumentId}
            highlightRowRef={page.handleHighlightRowRef}
          />
        )}
      </Stack>

      {/* Модальные окна: настройки колонок, карточка документа, ручное создание */}
      {page.columnsOpened && (
        <DocumentColumnSettingsModal
          opened
          value={page.columns}
          onChange={(next) => {
            page.setColumns(next);
            saveDocumentColumns(page.currentOrgId, next);
          }}
          onClose={() => page.setColumnsOpened(false)}
        />
      )}

      <DocumentCardModal
        documentId={page.selectedDocumentId}
        opened={!!page.selectedDocumentId}
        onClose={() => page.setSelectedDocumentId(null)}
        organizationId={page.currentOrgId}
        role={page.role}
        currentUserId={page.user?.id}
        objects={page.objects}
        users={page.usersQuery.data ?? []}
        initialTab={page.selectedTab}
      />

      {page.canCreate && page.manualOpened && (
        <ManualDocumentModal
          opened
          onClose={() => page.setManualOpened(false)}
          organizationId={page.currentOrgId}
          role={page.role}
          currentUserId={page.user?.id}
          objects={page.objects}
          users={page.usersQuery.data ?? []}
        />
      )}
    </Container>
  );
}
