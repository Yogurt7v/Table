import { useState } from 'react';
import { Paper, Skeleton, Stack } from '@mantine/core';
import type { MailType } from '@/shared/types';
import { MailSectionHeader } from '../mail-section/MailSectionHeader';
import { MailSectionTable } from '../mail-section/MailSectionTable';
import { MailSectionModals } from '../mail-section/MailSectionModals';
import { useMailSectionData } from '../mail-section/useMailSectionData';
import { useMailSectionActions } from '../mail-section/useMailSectionActions';
import { useMailSectionHighlight } from '../mail-section/useMailSectionHighlight';

interface MailSectionProps {
  orgId: string;
}

/**
 * Тело страницы почты: заголовок, поиск, две вкладки-регистра и все модалки.
 * Здесь только композиция — данные даёт `useMailSectionData`, действия и
 * состояние окон — `useMailSectionActions`, подсветка строки —
 * `useMailSectionHighlight`.
 *
 * Фильтры и поиск общие для обеих вкладок, и это не компромисс, а следствие
 * контракта API: параметр называется `counterparty`, а `buildIncomingMailFilter`
 * и `buildOutgoingMailFilter` сами подставляют нужное поле (`sender` либо
 * `recipient`). Второй набор фильтров пришлось бы синхронизировать вручную, и
 * он бы расходился при переключении вкладок.
 *
 * Различаются вкладки только пагинацией и ключом запроса (`incomingMails` /
 * `outgoingMails`), поэтому переключение вкладки не перезапрашивает уже
 * свежие данные — их держит кэш TanStack Query.
 *
 * Каждое действие gated флагом из `useMailPermissions`: запрещённого действия
 * в интерфейсе нет вовсе, а не «задизейблено». Набор и порядок колонок — тоже
 * (`resolveVisibleColumns` пересекает сохранённое с правами).
 *
 * Ни периода, ни архива здесь нет намеренно: все четыре предустановки периода
 * и произвольный диапазон живут в меню «Фильтр» (`MailFilters`) — единственном
 * месте, где и счётчик активных групп, и сброс живут одним списком. Архив
 * удалённых писем — единственная точка входа из админки («Архив сообщений»,
 * `AdminPage`), а не из реестра: на `/mail` его больше нет.
 */
export function MailSection({ orgId }: MailSectionProps) {
  const [tab, setTab] = useState<MailType>('incoming');
  const data = useMailSectionData(orgId, tab);
  const { highlightedMailId, requestHighlight } = useMailSectionHighlight();
  const actions = useMailSectionActions(orgId, tab, setTab, data, requestHighlight);

  if (!orgId) return null;

  if (!data.objects) {
    return (
      <Stack gap="sm" py="xs">
        <Skeleton height={32} radius="sm" />
        <Skeleton height={140} radius="md" />
        <Skeleton height={140} radius="md" />
      </Stack>
    );
  }

  const totalItems = data.isSearchMode
    ? (data.activeAll.data?.length ?? 0)
    : (data.active.data?.totalItems ?? 0);
  const loading = data.isSearchMode ? data.activeAll.isLoading : data.active.isLoading;
  const historyRow = data.rows.find((row) => row.id === actions.historyFor);

  return (
    <>
      {/* Основной блок страницы почты: шапка, поиск и таблица писем */}
      <Stack gap="md">
        <MailSectionHeader
          searchValue={data.filters.filters.search}
          onSearchChange={data.handleSearchChange}
          resultCount={data.rows.length}
          resultTotal={totalItems}
          allowedCreateTypes={data.allowedCreateTypes}
          onOpenColumnSettings={() => actions.setColumnSettingsOpen(true)}
          onCreate={(type) => {
            actions.setFormType(type);
            actions.setFormTarget({ mode: 'create' });
          }}
        />

        <Paper withBorder p="md" style={{ boxShadow: 'var(--mantine-shadow-sm)' }}>
          {/* Табличная часть: вкладки, фильтры и список писем */}
          <MailSectionTable
            orgId={orgId}
            tab={tab}
            setTab={setTab}
            rows={data.rows}
            visibleColumns={data.visibleColumns}
            permissions={data.permissions}
            page={data.page}
            pageCount={data.pageCount}
            totalItems={totalItems}
            loading={loading}
            filters={data.filters}
            objectNames={data.objectNames}
            responsibleOptions={data.responsibleOptions}
            chips={data.chips}
            highlightedMailId={highlightedMailId}
            onPageChange={data.setPage}
            onOpenFiles={actions.setFilesFor}
            onEdit={(mailId) => {
              actions.setFormType(tab);
              actions.setFormTarget({ mode: 'edit', mailId });
            }}
            onCopy={(mailId) => {
              actions.setFormType(tab);
              actions.setFormTarget({ mode: 'copy', mailId, sourceType: tab });
            }}
            onDelete={actions.setDeleteFor}
            onHistory={actions.setHistoryFor}
            onRelations={(mailId) => actions.setThreadTarget({ mailId, mailType: tab })}
            onResetFilters={data.filters.resetAll}
          />
        </Paper>
      </Stack>

      {/* Набор модальных окон раздела: форма, файлы, история, связи, настройки, удаление */}
      <MailSectionModals
        form={{
          formTarget: actions.formTarget,
          formType: actions.formType,
          editingMail: actions.editingMail,
          allowedCreateTypes: data.allowedCreateTypes,
          counterpartyOptions: actions.counterpartyOptions,
          candidates: data.thread.candidates,
          parentEdges: data.thread.parentEdges,
          canLinkCurrent: actions.canLinkCurrent,
          saving: actions.saving,
          onCloseForm: () => actions.setFormTarget(null),
          onTypeChange: actions.setFormType,
          onSave: actions.handleSave,
          onOpenThread: (type, id) => actions.setThreadTarget({ mailId: id, mailType: type }),
          objectNames: data.objectNames,
          responsibleOptions: data.responsibleOptions,
        }}
        files={{
          filesFor: actions.filesFor,
          setFilesFor: actions.setFilesFor,
          canManageFiles: data.permissions.canManageFiles,
          orgId,
          tab,
          labelFor: actions.labelFor,
        }}
        history={{
          historyFor: actions.historyFor,
          setHistoryFor: actions.setHistoryFor,
          createdByName: historyRow?.createdByName,
          createdAt: historyRow?.created,
          orgId,
          tab,
          labelFor: actions.labelFor,
        }}
        thread={{
          threadTarget: actions.threadTarget,
          setThreadTarget: actions.setThreadTarget,
          orgId,
          tab,
          permissions: data.permissions,
          onGoToRegister: actions.handleGoToRegister,
        }}
        columns={{
          visibleColumns: data.visibleColumns,
          columnSettingsOpen: actions.columnSettingsOpen,
          setColumnSettingsOpen: actions.setColumnSettingsOpen,
          handleColumnChange: data.handleColumnChange,
          permissions: data.permissions,
          tab,
        }}
        deleteDialog={{
          deleteFor: actions.deleteFor,
          deleteMailSubject: actions.deleteMailSubject,
          deleteReason: actions.deleteReason,
          setDeleteReason: actions.setDeleteReason,
          closeDeleteModal: actions.closeDeleteModal,
          confirmDelete: actions.confirmDelete,
          deleteIncoming: actions.deleteIncoming,
          deleteOutgoing: actions.deleteOutgoing,
        }}
      />
    </>
  );
}
