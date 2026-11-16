import type { Dispatch, SetStateAction } from 'react';
import { MailFilesModal } from '@/features/mail/MailFilesModal';
import { MailHistoryModal } from '@/features/mail/MailHistoryModal';
import { MailThreadBuilder } from '@/features/mail/MailThreadBuilder';
import { MailColumnSettingsModal } from '@/features/mail/MailColumnSettingsModal';
import type { MailColumnId } from '@/features/mail/mail-columns';
import type { MailPermissions } from '@/features/mail/mail-field-access';
import type { MailType } from '@/shared/types';

type ThreadTarget = { mailId: string; mailType: MailType };

export interface MailSectionAuxModalsProps {
  filesFor: string | null;
  canManageFiles: boolean;
  historyFor: string | null;
  createdByName: string | undefined;
  createdAt: string | undefined;
  threadTarget: ThreadTarget | null;
  onGoToRegister: (mailId: string, mailType: MailType, dateKey: string) => void;
  visibleColumns: MailColumnId[];
  columnSettingsOpen: boolean;
  handleColumnChange: (columns: MailColumnId[]) => void;
  setColumnSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setFilesFor: Dispatch<SetStateAction<string | null>>;
  setHistoryFor: Dispatch<SetStateAction<string | null>>;
  setThreadTarget: Dispatch<SetStateAction<ThreadTarget | null>>;
  orgId: string;
  tab: MailType;
  permissions: MailPermissions;
  labelFor: (mailId: string | null) => string;
}

/**
 * Вспомогательные модальные окна раздела писем.
 * Рендерит окна файлов, истории, дерева переписки и настройки колонок.
 */
export function MailSectionAuxModals({
  filesFor,
  canManageFiles,
  historyFor,
  createdByName,
  createdAt,
  threadTarget,
  onGoToRegister,
  visibleColumns,
  columnSettingsOpen,
  handleColumnChange,
  setColumnSettingsOpen,
  setFilesFor,
  setHistoryFor,
  setThreadTarget,
  orgId,
  tab,
  permissions,
  labelFor,
}: MailSectionAuxModalsProps) {
  return (
    <>
      {/* Файлы письма */}
      <MailFilesModal
        mailId={filesFor}
        mailType={tab}
        mailLabel={labelFor(filesFor)}
        orgId={orgId}
        opened={filesFor !== null}
        canManageFiles={canManageFiles}
        onClose={() => setFilesFor(null)}
      />

      {/* История письма */}
      <MailHistoryModal
        mailId={historyFor}
        mailType={tab}
        mailLabel={labelFor(historyFor)}
        createdByName={createdByName}
        createdAt={createdAt}
        opened={historyFor !== null}
        onClose={() => setHistoryFor(null)}
      />

      {/* Дерево переписки */}
      <MailThreadBuilder
        opened={threadTarget !== null}
        onClose={() => setThreadTarget(null)}
        orgId={orgId}
        permissions={permissions}
        rootMailId={threadTarget?.mailId ?? ''}
        rootMailType={threadTarget?.mailType ?? tab}
        onGoToRegister={onGoToRegister}
      />

      {/* Настройки колонок таблицы */}
      <MailColumnSettingsModal
        key={columnSettingsOpen ? 'open' : 'closed'}
        opened={columnSettingsOpen}
        value={visibleColumns}
        permissions={permissions}
        mailType={tab}
        onChange={handleColumnChange}
        onClose={() => setColumnSettingsOpen(false)}
      />
    </>
  );
}