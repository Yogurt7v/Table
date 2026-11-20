import { useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { IAccountingObject } from '@/shared/types';
import { useDocumentPermissions } from '@/features/documents/hooks/useDocumentPermissions';
import { useMailPermissions } from '@/shared/hooks/useMailPermissions';
import { useOrg } from '@/shared/context/OrgContext';
import { InvoiceObjectBlock } from '../invoice-object-block/InvoiceObjectBlock';
import { CollapseObjectsButton } from './objects-list/CollapseObjectsButton';
import { HiddenObjectsSection } from './objects-list/HiddenObjectsSection';
import { InvoiceSectionObjectsHeader } from './objects-list/InvoiceSectionObjectsHeader';
import { InvoiceStatusFilterMenu } from './objects-list/InvoiceStatusFilterMenu';
import { useInvoiceSectionObjectsList } from './objects-list/useInvoiceSectionObjectsList';
import type { InvoiceSectionObjectsListProps } from './objects-list/invoice-section-objects-list-types';

export type { InvoiceSectionObjectsListProps } from './objects-list/invoice-section-objects-list-types';

/**
 * Список объектов секции счетов: шапка (мобильная/десктопная) с фильтром,
 * сворачиванием и действиями, блоки объектов с таблицами счетов и секция
 * «Объекты без счетов». Состояние сворачивания — в `useInvoiceSectionObjectsList`.
 */
export function InvoiceSectionObjectsList({
  orgId,
  date,
  objects,
  hiddenObjects,
  allObjects,
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
}: InvoiceSectionObjectsListProps) {
  const {
    hiddenOpen,
    allCollapsed,
    showCollapseButton,
    handleCollapseAll,
    handleExpandAll,
    toggleHiddenOpen,
  } = useInvoiceSectionObjectsList(objects, hiddenObjects, hasSearch);

  const isFullAccess =
    permissions.role === 'admin' || permissions.role === 'moderator' || permissions.role === 'boss';

  const { currentOrgId } = useOrg();
  const mailPermissions = useMailPermissions(currentOrgId);
  const documentPermissions = useDocumentPermissions(currentOrgId);
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  // Блок объекта учёта с таблицей/карточками счетов.
  const renderObjectBlock = (obj: IAccountingObject) => (
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
      accountingObjects={allObjects}
      paymentMarks={paymentMarks}
      filesByInvoice={filesByInvoice}
      visibleColumns={visibleColumns}
      onOpenDraft={onOpenDraft}
      onCancelDraft={onCancelDraft}
      onPrint={onPrint}
      onExport={onExport}
    />
  );

  // Элементы управления: фильтр по статусу и сворачивание всех групп.
  const filterMenu = (
    <InvoiceStatusFilterMenu
      isFullAccess={isFullAccess}
      activeFilters={activeFilters}
      onActiveFiltersChange={onActiveFiltersChange}
    />
  );

  const collapseButton = (
    <CollapseObjectsButton
      show={showCollapseButton}
      allCollapsed={allCollapsed}
      onExpandAll={handleExpandAll}
      onCollapseAll={handleCollapseAll}
    />
  );

  // Шапка, список видимых блоков по объектам и секция объектов без счетов.
  return (
    <>
      <InvoiceSectionObjectsHeader
        isMobile={!!isMobile}
        canViewMail={mailPermissions.canView}
        canViewDocuments={documentPermissions.canView}
        paidTodayTotal={paidTodayTotal}
        filterControl={filterMenu}
        collapseControl={collapseButton}
        onColumnSettingsClick={onColumnSettingsClick}
        onPrintAll={onPrintAll}
        onExportAll={onExportAll}
      />

      {/* Группы счетов по объектам учёта */}
      {objects.map(renderObjectBlock)}

      {/* Объекты без счетов (сворачиваемая секция) */}
      <HiddenObjectsSection
        hiddenObjects={hiddenObjects}
        opened={hiddenOpen}
        onToggle={toggleHiddenOpen}
        renderObjectBlock={renderObjectBlock}
      />
    </>
  );
}
