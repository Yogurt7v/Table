import MailFilesDialog from '@/features/mail/ui/files/MailFilesDialog';
import { MailHistoryModal } from '@/features/mail/ui/history/MailHistoryModal';
import { MailThreadBuilder } from '@/features/mail/ui/thread/MailThreadBuilder';
import { MailColumnSettingsModal } from '@/features/mail/ui/columns/MailColumnSettingsModal';
import type {
  MailColumnsDialogProps,
  MailFilesDialogProps,
  MailHistoryDialogProps,
  MailThreadDialogProps,
} from './mail-section-types';

/** Пропсы вспомогательных модалок: файлы, история, дерево и колонки. */
export interface MailSectionAuxModalsProps {
  files: MailFilesDialogProps;
  history: MailHistoryDialogProps;
  thread: MailThreadDialogProps;
  columns: MailColumnsDialogProps;
}

/**
 * Вспомогательные модальные окна раздела писем.
 * Рендерит окна файлов, истории, дерева переписки и настройки колонок —
 * по одному пропу-объекту на окно.
 */
export function MailSectionAuxModals({
  files,
  history,
  thread,
  columns,
}: MailSectionAuxModalsProps) {
  return (
    <>
      {/* Файлы письма */}
      <MailFilesDialog
        mailId={files.filesFor}
        mailType={files.tab}
        mailLabel={files.labelFor(files.filesFor)}
        orgId={files.orgId}
        opened={files.filesFor !== null}
        canManageFiles={files.canManageFiles}
        onClose={() => files.setFilesFor(null)}
      />

      {/* История письма */}
      <MailHistoryModal
        mailId={history.historyFor}
        mailType={history.tab}
        mailLabel={history.labelFor(history.historyFor)}
        createdByName={history.createdByName}
        createdAt={history.createdAt}
        opened={history.historyFor !== null}
        onClose={() => history.setHistoryFor(null)}
      />

      {/* Дерево переписки */}
      <MailThreadBuilder
        opened={thread.threadTarget !== null}
        onClose={() => thread.setThreadTarget(null)}
        orgId={thread.orgId}
        permissions={thread.permissions}
        rootMailId={thread.threadTarget?.mailId ?? ''}
        rootMailType={thread.threadTarget?.mailType ?? thread.tab}
        onGoToRegister={thread.onGoToRegister}
      />

      {/* Настройки колонок таблицы */}
      <MailColumnSettingsModal
        key={columns.columnSettingsOpen ? 'open' : 'closed'}
        opened={columns.columnSettingsOpen}
        value={columns.visibleColumns}
        permissions={columns.permissions}
        mailType={columns.tab}
        onChange={columns.handleColumnChange}
        onClose={() => columns.setColumnSettingsOpen(false)}
      />
    </>
  );
}
