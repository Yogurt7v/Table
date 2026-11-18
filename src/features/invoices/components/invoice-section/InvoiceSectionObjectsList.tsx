import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Collapse,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronsDown,
  IconChevronsUp,
  IconFileExport,
  IconFilter,
  IconPrinter,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import type {
  IAccountingObject,
  IInvoice,
  IInvoiceFile,
  IPaymentMark,
  InvoiceColumnId,
} from '@/shared/types';
import { useCollapsedObjects } from '@/shared/context/CollapsedObjectsContext';
import { useDocumentPermissions } from '@/shared/hooks/useDocumentPermissions';
import { useMailPermissions } from '@/shared/hooks/useMailPermissions';
import { useOrg } from '@/shared/context/OrgContext';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { InvoiceObjectBlock } from '../InvoiceObjectBlock';
import {
  ALL_INVOICE_FILTERS,
  REDUCED_INVOICE_FILTERS,
  INVOICE_FILTER_LABELS,
} from '../../utils/invoice-filter';
import type { InvoiceFilterType } from '../../utils/invoice-filter';

export interface InvoiceSectionObjectsListProps {
  orgId: string;
  date: string;
  objects: IAccountingObject[];
  hiddenObjects: IAccountingObject[];
  allObjects: IAccountingObject[];
  invoices: IInvoice[] | undefined;
  highlightedIds: string[];
  hasSearch: boolean;
  draftObjectId: string | null;
  permissions: { canCreate: boolean; role: string | null };
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
  const { collapsedIds, collapseAll, expand, expandAll } = useCollapsedObjects();
  const [hiddenOpen, setHiddenOpen] = useState(hasSearch);
  const allCollapsed =
    objects.length > 0 && !hiddenOpen && objects.every((o) => collapsedIds.has(o.id));
  const showCollapseButton = objects.length > 1 || (objects.length > 0 && hiddenObjects.length > 0);
  const isFullAccess =
    permissions.role === 'admin' || permissions.role === 'moderator' || permissions.role === 'boss';

  const { currentOrgId } = useOrg();
  const mailPermissions = useMailPermissions(currentOrgId);
  const documentPermissions = useDocumentPermissions(currentOrgId);
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  const prevHasSearchRef = useRef(hasSearch);

  useEffect(() => {
    if (hasSearch) expandAll();
  }, [hasSearch, expandAll]);

  useEffect(() => {
    if (hasSearch && !prevHasSearchRef.current) {
      setHiddenOpen(true);
    }
    prevHasSearchRef.current = hasSearch;
  }, [hasSearch]);

  const handleCollapseAll = () => {
    collapseAll();
    setHiddenOpen(false);
  };

  const handleExpandAll = () => {
    expand(objects.map((o) => o.id));
  };

  // Блок объекта учёта с таблицей/карточками счетов
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

  // Меню фильтра по статусу счёта (полный/сокращённый набор по роли)
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
        {/* Пункты статуса счёта */}
        <Menu.Label>Статус счёта</Menu.Label>
        {(isFullAccess ? ALL_INVOICE_FILTERS : REDUCED_INVOICE_FILTERS).map((filter) => {
          const isActive = activeFilters.includes(filter);
          return (
            <Menu.Item
              key={filter}
              leftSection={
                isActive ? (
                  <IconCheck size={16} color="var(--mantine-color-blue-filled)" />
                ) : (
                  <Box w={16} />
                )
              }
              color={isActive ? 'blue' : undefined}
              onClick={() =>
                onActiveFiltersChange(
                  isActive ? activeFilters.filter((f) => f !== filter) : [...activeFilters, filter],
                )
              }
            >
              {INVOICE_FILTER_LABELS[filter]}
            </Menu.Item>
          );
        })}
        {/* Сброс всех активных фильтров */}
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

  // Кнопка «Свернуть/Развернуть» все группы объектов
  const collapseButton = showCollapseButton ? (
    <Button
      size="compact-sm"
      variant="light"
      color="gray"
      flex="1"
      rightSection={allCollapsed ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
      onClick={allCollapsed ? handleExpandAll : handleCollapseAll}
      leftSection={allCollapsed ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
    >
      {allCollapsed ? 'Развернуть' : 'Свернуть'}
    </Button>
  ) : null;

  // Рендерит шапку с действиями, список блоков объектов и секцию объектов без счетов
  return (
    <>
      {/* Мобильная шапка: заголовок, действия, фильтр и сворачивание */}
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
              </Tooltip>
            )}
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
              </Tooltip>
            )}
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
          {/* Фильтр и сворачивание групп (мобильная компоновка) */}
          {filterMenu}
          {collapseButton}
        </Group>
      </Box>
      {/* Десктопная шапка: хлебные крошки, заголовок, фильтр и действия */}
      <Box visibleFrom="sm">
        <Group justify="space-between" mb="sm" wrap="wrap">
          <Group gap={8} justify="flex-start" flex="1">
            {mailPermissions.canView && (
              <Group gap={6} wrap="nowrap">
                <Anchor
                  size="sm"
                  component={Link}
                  to="/mail"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: 'black',
                    fontWeight: 'bolder',
                    fontSize: '16px',
                  }}
                >
                  Почта
                  {/*<IconMail size={16} aria-hidden /> */}
                </Anchor>
                /{' '}
              </Group>
            )}
            {documentPermissions.canView && (
              <Group gap={6} wrap="nowrap">
                <Anchor
                  size="sm"
                  component={Link}
                  to="/docs"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: 'black',
                    fontWeight: 'bolder',
                    fontSize: '16px',
                  }}
                >
                  Документы
                </Anchor>
                /{' '}
              </Group>
            )}

            <Title order={3}>Счета</Title>
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

            {/* Фильтр и сворачивание групп (десктопная компоновка) */}
            {filterMenu}

            {collapseButton}
          </Group>
          {paidTodayTotal > 0 && <Text size="lg">Оплачено: {formatAmountRub(paidTodayTotal)}</Text>}
        </Group>
      </Box>
      {/* Группы счетов по объектам учёта */}
      {objects.map(renderObjectBlock)}

      {/* Объекты без счетов (сворачиваемая секция) */}
      {hiddenObjects.length > 0 && (
        <Paper
          withBorder
          p={0}
          style={{
            borderLeft: '3px dashed var(--mantine-color-gray-4)',
            boxShadow: 'var(--mantine-shadow-sm)',
          }}
        >
          <Group
            gap={4}
            onClick={() => setHiddenOpen((v) => !v)}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              padding: 'var(--mantine-spacing-xs)',
              height: 48,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--mantine-color-dimmed)',
            }}
            role="button"
            aria-expanded={hiddenOpen}
            aria-label={
              hiddenOpen ? 'Свернуть объекты без счетов' : 'Развернуть объекты без счетов'
            }
          >
            {hiddenOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
            <Title order={5} c="dimmed">
              Объекты без счетов ({hiddenObjects.length})
            </Title>
          </Group>
          <Collapse in={hiddenOpen}>
            <Stack gap="sm" p="sm">
              {hiddenObjects.map(renderObjectBlock)}
            </Stack>
          </Collapse>
        </Paper>
      )}
    </>
  );
}
