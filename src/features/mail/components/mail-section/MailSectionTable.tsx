import { Box, Stack, Tabs } from '@mantine/core';
import { MailFilters } from '@/features/mail/MailFilters';
import { MailTable } from '@/features/mail/MailTable';
import type { MailColumnId } from '@/features/mail/mail-columns';
import type { MailPermissions } from '@/features/mail/mail-field-access';
import type { MailRow } from '@/features/mail/mail-row';
import type { MailType } from '@/shared/types';
import { MAIL_REGISTER_TAB_LABELS } from '@/features/mail/mail-labels';
import type { MailFilterChip, UseMailFiltersResult } from '@/features/mail/useMailFilters';

export interface MailSectionTableProps {
  orgId: string;
  tab: MailType;
  setTab: (tab: MailType) => void;
  rows: MailRow[];
  visibleColumns: MailColumnId[];
  permissions: MailPermissions;
  page: number;
  pageCount: number;
  totalItems: number;
  loading: boolean;
  filters: UseMailFiltersResult;
  objectNames: Map<string, string>;
  responsibleOptions: Array<{ id: string; name: string }>;
  chips: MailFilterChip[];
  highlightedMailId: string | null;
  onPageChange: (page: number) => void;
  onOpenFiles: (mailId: string) => void;
  onEdit: (mailId: string) => void;
  onCopy: (mailId: string) => void;
  onDelete: (mailId: string) => void;
  onHistory: (mailId: string) => void;
  onRelations: (mailId: string) => void;
  onResetFilters: () => void;
}

/**
 * Таблица писем с вкладками «Входящие»/«Исходящие».
 * Рендерит переключатель регистров, панель фильтров и таблицу писем выбранного типа.
 */
export function MailSectionTable({
  orgId,
  tab,
  setTab,
  rows,
  visibleColumns,
  permissions,
  page,
  pageCount,
  totalItems,
  loading,
  filters,
  objectNames,
  responsibleOptions,
  chips,
  highlightedMailId,
  onPageChange,
  onOpenFiles,
  onEdit,
  onCopy,
  onDelete,
  onHistory,
  onRelations,
  onResetFilters,
}: MailSectionTableProps) {
  return (
    <Tabs value={tab} onChange={(value) => value && setTab(value as MailType)} keepMounted={false}>
      {/* Вкладки переключения между регистрами входящей и исходящей почты */}
      <Tabs.List>
        <Tabs.Tab value="incoming">{MAIL_REGISTER_TAB_LABELS.incoming}</Tabs.Tab>
        <Tabs.Tab value="outgoing">{MAIL_REGISTER_TAB_LABELS.outgoing}</Tabs.Tab>
      </Tabs.List>

      {/* Содержимое активного регистра: фильтры и таблица писем */}
      <Tabs.Panel value={tab} pt="md">
        <Stack gap="sm">
          {/* Панель фильтров и активных чипов отбора */}
          <MailFilters
            filters={filters}
            mailType={tab}
            accountingObjects={[...objectNames].map(([id, name]) => ({ id, name }))}
            responsibleOptions={responsibleOptions}
            chips={chips}
          />
          {/* Таблица писем с пагинацией и действиями над строками */}
          <Box>
            <MailTable
              orgId={orgId}
              mailType={tab}
              rows={rows}
              visibleColumns={visibleColumns}
              loading={loading}
              objectNames={objectNames}
              permissions={permissions}
              page={page}
              pageCount={pageCount}
              totalItems={totalItems}
              onPageChange={onPageChange}
              onOpenFiles={onOpenFiles}
              onEdit={onEdit}
              onCopy={onCopy}
              onDelete={onDelete}
              onHistory={onHistory}
              onRelations={onRelations}
              onResetFilters={onResetFilters}
              hasFilters={filters.activeCount > 0}
              highlightedMailId={highlightedMailId}
              emptyHint={
                filters.activeCount > 0 ? 'Писем по заданным условиям нет' : 'Писем пока нет'
              }
            />
          </Box>
        </Stack>
      </Tabs.Panel>
    </Tabs>
  );
}
