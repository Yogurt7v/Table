import { useMemo, useState } from 'react';
import {
  Badge,
  Paper,
  Title,
  Group,
  Button,
  Skeleton,
  Stack,
  Text,
  ActionIcon,
  Tooltip,
  Collapse,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconPlus,
  IconPrinter,
  IconFileExport,
  IconChevronRight,
  IconChevronDown,
} from '@tabler/icons-react';
import { useCollapsedObjects } from '@/shared/context/CollapsedObjectsContext';
import { useDatePinned } from '@/shared/context/DatePinnedContext';
import { InvoiceTable } from '@/features/invoices/ui/invoice-table/InvoiceTable';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { pluralCount } from '@/shared/utils/plural-ru';
import { filterObjectInvoices } from '@/features/invoices/ui/invoice-section/invoice-section-utils';
import type { InvoiceFilterType } from '@/features/invoices/utils/invoice-filter';
import type {
  IInvoice,
  IAccountingObject,
  IPaymentMark,
  IInvoiceFile,
  InvoiceColumnId,
} from '@/shared/types';

interface InvoiceObjectBlockProps {
  obj: IAccountingObject;
  invoices: IInvoice[] | undefined;
  activeFilters: InvoiceFilterType[];
  orgId: string;
  date: string;
  highlightedIds: string[];
  hasSearch: boolean;
  searchText: string;
  draftObjectId: string | null;
  permissions: { canCreate: boolean };
  accountingObjects: IAccountingObject[];
  paymentMarks: IPaymentMark[] | undefined;
  filesByInvoice: Record<string, IInvoiceFile[]>;
  visibleColumns: InvoiceColumnId[];
  onOpenDraft: (id: string) => void;
  onCancelDraft: () => void;
  onPrint?: (objId: string) => void;
  onExport?: (objId: string) => void;
}

export function InvoiceObjectBlock({
  obj,
  invoices,
  activeFilters,
  orgId,
  date,
  highlightedIds,
  hasSearch,
  searchText,
  draftObjectId,
  permissions,
  accountingObjects,
  paymentMarks,
  filesByInvoice,
  visibleColumns,
  onOpenDraft,
  onCancelDraft,
  onPrint,
  onExport,
}: InvoiceObjectBlockProps) {
  const objInvoices = useMemo(
    () =>
      filterObjectInvoices(
        invoices,
        obj.id,
        paymentMarks,
        activeFilters,
        hasSearch,
        highlightedIds,
      ),
    [invoices, paymentMarks, activeFilters, obj.id, hasSearch, highlightedIds],
  );
  const matchCount = objInvoices.length;

  // Локальное раскрытие блока в поиске не пишет в localStorage, чтобы не стирать
  // сохранённые группы пользователя. Override привязан к тексту поиска и
  // сбрасывается сам при смене запроса.
  const [searchExpanded, setSearchExpanded] = useState<{
    searchText: string;
    expanded: boolean;
  } | null>(null);
  const activeSearchExpanded =
    searchExpanded?.searchText === searchText ? searchExpanded.expanded : null;

  const { isCollapsed, toggle } = useCollapsedObjects();

  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const { pinned } = useDatePinned();
  const stickyTop = isMobile ? (pinned ? 132 : 88) : 56;

  const isDraftOpen = draftObjectId === obj.id;
  const hasDraftElsewhere = draftObjectId !== null && draftObjectId !== obj.id;

  const isSearchEmpty = hasSearch && matchCount === 0;
  const collapsed = isDraftOpen
    ? false
    : hasSearch
      ? activeSearchExpanded === null
        ? matchCount === 0
        : !activeSearchExpanded
      : isCollapsed(obj.id);

  // Клик по шапке: в поиске раскрывает/сворачивает только этот блок, вне поиска
  // переключает сохранённую группу.
  const handleHeaderClick = () => {
    if (hasSearch) {
      setSearchExpanded({ searchText, expanded: collapsed });
      return;
    }
    toggle(obj.id);
  };

  const totalAmount = useMemo(() => {
    return objInvoices.reduce((sum, inv) => {
      if (!inv.paid) return sum + inv.amount;
      return sum;
    }, 0);
  }, [objInvoices]);

  return (
    <Paper
      key={obj.id}
      withBorder
      p="sm"
      style={{
        borderLeft: '3px solid var(--org-color, #228be6)',
        boxShadow: 'var(--mantine-shadow-sm)',
      }}
    >
      <Group
        gap={4}
        mb={0}
        style={{
          position: 'sticky',
          top: stickyTop,
          zIndex: 2,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--mantine-color-body)',
          cursor: 'pointer',
          userSelect: 'none',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-sm)',
          padding: 'var(--mantine-spacing-xs)',
          opacity: isSearchEmpty ? 0.55 : 1,
          transition: 'opacity 150ms ease',
        }}
        onClick={handleHeaderClick}
      >
        {collapsed ? <IconChevronRight size={18} /> : <IconChevronDown size={18} />}
        <Title order={5} c={isSearchEmpty ? 'dimmed' : undefined}>
          {obj.name}
        </Title>
        {hasSearch && (
          <Badge size="sm" variant="light" color={isSearchEmpty ? 'gray' : 'blue'}>
            {isSearchEmpty
              ? 'Нет совпадений'
              : pluralCount(matchCount, ['совпадение', 'совпадения', 'совпадений'])}
          </Badge>
        )}
        {onPrint && !isMobile && !isSearchEmpty && (
          <Tooltip label="Печать">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                onPrint(obj.id);
              }}
            >
              <IconPrinter size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        {onExport && !isSearchEmpty && (
          <Tooltip label="Экспорт в Excel">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                onExport(obj.id);
              }}
            >
              <IconFileExport size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      {!invoices ? (
        <Collapse in={!collapsed}>
          <Stack gap="xs">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={22} radius="sm" />
            ))}
          </Stack>
        </Collapse>
      ) : (
        <>
          <Collapse in={!collapsed}>
            <InvoiceTable
              orgId={orgId}
              objectId={obj.id}
              date={date}
              invoices={objInvoices}
              allInvoices={invoices}
              highlightedIds={highlightedIds}
              isDraftOpen={isDraftOpen}
              hasDraftElsewhere={hasDraftElsewhere}
              onOpenDraft={onOpenDraft}
              onCancelDraft={onCancelDraft}
              accountingObjects={accountingObjects}
              paymentMarks={paymentMarks}
              filesByInvoice={filesByInvoice}
              visibleColumns={visibleColumns}
              onAddClick={permissions.canCreate ? () => onOpenDraft(obj.id) : undefined}
            />
            {permissions.canCreate && (
              <Group justify="flex-end" mt="sm">
                <Button
                  leftSection={<IconPlus size={16} />}
                  disabled={isDraftOpen || hasDraftElsewhere}
                  onClick={() => onOpenDraft(obj.id)}
                >
                  Добавить счёт
                </Button>
              </Group>
            )}
          </Collapse>
          {objInvoices.length > 0 && (
            <Text ta="right" fw={700} mt="md">
              Итого по "{obj.name}": {formatAmountRub(totalAmount)}
            </Text>
          )}
        </>
      )}
    </Paper>
  );
}
