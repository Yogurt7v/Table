import { Group, Text, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { MailFormModal } from '@/features/mail/MailFormModal';
import { MailFilesModal } from '@/features/mail/MailFilesModal';
import { MailHistoryModal } from '@/features/mail/MailHistoryModal';
import { MailThreadBuilder } from '@/features/mail/MailThreadBuilder';
import { MailColumnSettingsModal } from '@/features/mail/MailColumnSettingsModal';
import type { MailColumnId } from '@/features/mail/mail-columns';
import type { MailPermissions } from '@/features/mail/mail-field-access';
import type { MailFormState, MailNodeKey } from '@/features/mail/mail-form';

export interface MailSectionModalsProps {
  // Form modal
  formTarget: { mode: string; mailId?: string; sourceType?: string } | null;
  formType: string;
  editingMail: unknown;
  allowedCreateTypes: string[];
  counterpartyOptions: string[];
  candidates: unknown[];
  parentEdges: unknown[];
  canLinkCurrent: boolean;
  saving: boolean;
  onCloseForm: () => void;
  onTypeChange: (type: string) => void;
  onSave: (type: string, form: MailFormState, parentKey: MailNodeKey | null) => void;
  onOpenThread: (type: string, id: string) => void;

  // Files modal
  filesFor: string | null;
  canManageFiles: boolean;

  // History modal
  historyFor: string | null;
  createdByName: string | undefined;
  createdAt: string | undefined;

  // Thread builder
  threadTarget: { mailId: string; mailType: string } | null;
  onGoToRegister: (mailId: string, mailType: string, dateKey: string) => void;

  // Column settings
  visibleColumns: MailColumnId[];

  // Delete modal
  deleteMailSubject: React.ReactNode;
  deleteReason: string;
  closeDeleteModal: () => void;
  confirmDelete: () => void;

  orgId: string;
  tab: string;
  permissions: MailPermissions;
  objectNames: Map<string, string>;
  responsibleOptions: Array<{ id: string; name: string }>;
  labelFor: (mailId: string | null) => string;
  columnSettingsOpen: boolean;
  handleColumnChange: (columns: MailColumnId[]) => void;
  setColumnSettingsOpen: (open: boolean) => void;
  deleteFor: string | null;
  deleteIncoming: { isPending: boolean };
  deleteOutgoing: { isPending: boolean };
  setDeleteReason: (reason: string) => void;
  setFilesFor: (mailId: string | null) => void;
  setHistoryFor: (mailId: string | null) => void;
  setThreadTarget: (target: { mailId: string; mailType: string } | null) => void;
}

/**
 * Модальные окна раздела переписки.
 * Управляет всеми модалками: форма письма, файлы, история, дерево переписки,
 * настройки колонок и подтверждение удаления.
 */
export function MailSectionModals({
  formTarget,
  formType,
  editingMail,
  allowedCreateTypes,
  counterpartyOptions,
  candidates,
  parentEdges,
  canLinkCurrent,
  saving,
  onCloseForm,
  onTypeChange,
  onSave,
  onOpenThread,
  filesFor,
  canManageFiles,
  historyFor,
  createdByName,
  createdAt,
  threadTarget,
  onGoToRegister,
  visibleColumns,
  deleteMailSubject,
  deleteReason,
  closeDeleteModal,
  confirmDelete,
  orgId,
  tab,
  permissions,
  objectNames,
  responsibleOptions,
  labelFor,
  columnSettingsOpen,
  handleColumnChange,
  setColumnSettingsOpen,
  deleteFor,
  deleteIncoming,
  deleteOutgoing,
  setDeleteReason,
  setFilesFor,
  setHistoryFor,
  setThreadTarget,
}: MailSectionModalsProps) {
  return (
    <>
      {/* Форма создания/редактирования письма */}
      <MailFormModal
        opened={formTarget !== null}
        onClose={onCloseForm}
        mailType={formType}
        mail={formTarget && formTarget.mode !== 'create' ? (editingMail ?? null) : null}
        copying={formTarget?.mode === 'copy'}
        allowedTypes={allowedCreateTypes}
        accountingObjects={[...objectNames].map(([value, label]) => ({ value, label }))}
        responsibleOptions={responsibleOptions.map((option) => ({
          value: option.id,
          label: option.name,
        }))}
        counterpartyOptions={counterpartyOptions}
        candidates={candidates}
        parentEdges={parentEdges}
        canLink={canLinkCurrent}
        saving={saving}
        onTypeChange={onTypeChange}
        onSave={onSave}
        onOpenThread={(mailType, mailId) => onOpenThread({ mailId, mailType })}
      />

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

      {/* Подтверждение удаления письма */}
      <ConfirmModal
        opened={deleteFor !== null}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Удаление письма"
        size="md"
        subject={deleteMailSubject}
        note="Письмо переместится в архив. Вложения останутся доступны и после восстановления."
        confirmDisabled={
          deleteReason.trim() === '' || deleteIncoming.isPending || deleteOutgoing.isPending
        }
        confirmLeftSection={<IconTrash size={16} />}
        confirmBlocked
      >
        <TextInput
          label="Причина удаления"
          aria-label="Причина удаления"
          placeholder="Например: письмо отправлено ошибочно"
          description={
            <Group component="span" justify="space-between" gap="sm" wrap="nowrap">
              <Text component="span" size="xs" flex={1}>
                Сохранится в архивной записи и в истории письма.
              </Text>
              <Text component="span" size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {deleteReason.length > 0 ? `${deleteReason.length} симв.` : ''}
              </Text>
            </Group>
          }
          required
          value={deleteReason}
          onChange={(event) => setDeleteReason(event.currentTarget.value)}
        />
      </ConfirmModal>
    </>
  );
}
