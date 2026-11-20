import type { ReactNode } from 'react';
import { ActionIcon, Anchor, Box, Group, Text, Title, Tooltip } from '@mantine/core';
import { IconFileExport, IconPrinter, IconSettings } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { formatAmountRub } from '@/shared/utils/format-currency';

interface InvoiceSectionObjectsHeaderProps {
  isMobile: boolean;
  canViewMail: boolean;
  canViewDocuments: boolean;
  paidTodayTotal: number;
  filterControl: ReactNode;
  collapseControl: ReactNode;
  onColumnSettingsClick: () => void;
  onPrintAll: () => void;
  onExportAll: () => void;
}

/**
 * Шапка секции счетов в двух компоновках: мобильной (заголовок + действия,
 * фильтр/сворачивание отдельной строкой) и десктопной (навигация, действия,
 * итог по оплате за день).
 */
export function InvoiceSectionObjectsHeader({
  isMobile,
  canViewMail,
  canViewDocuments,
  paidTodayTotal,
  filterControl,
  collapseControl,
  onColumnSettingsClick,
  onPrintAll,
  onExportAll,
}: InvoiceSectionObjectsHeaderProps) {
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
          {filterControl}
          {collapseControl}
        </Group>
      </Box>

      {/* Десктопная шапка: хлебные крошки, заголовок, фильтр и действия */}
      <Box visibleFrom="sm">
        <Group justify="space-between" mb="sm" wrap="wrap">
          <Group gap={8} justify="flex-start" flex="1">
            {canViewMail && (
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
            {canViewDocuments && (
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
            {filterControl}
            {collapseControl}
          </Group>
          {paidTodayTotal > 0 && <Text size="lg">Оплачено: {formatAmountRub(paidTodayTotal)}</Text>}
        </Group>
      </Box>
    </>
  );
}
