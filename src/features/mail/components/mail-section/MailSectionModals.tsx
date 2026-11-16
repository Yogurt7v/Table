import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { MailSectionFormModal } from './MailSectionFormModal';
import { MailSectionAuxModals } from './MailSectionAuxModals';
import { MailSectionDeleteModal } from './MailSectionDeleteModal';
import type { MailFormTarget } from './MailSectionFormModal';
import type { MailColumnId } from '@/features/mail/mail-columns';
import type { MailPermissions } from '@/features/mail/mail-field-access';
import type { MailFormState } from '@/features/mail/mail-form';
import type { MailCandidateLookup, ParentEdgeIndex } from '@/features/mail/mail-parent';
import type { MailNodeKey } from '@/features/mail/mail-thread';
import type { IIncomingMail, IOutgoingMail, MailType } from '@/shared/types';

type ThreadTarget = { mailId: string; mailType: MailType };

export interface MailSectionModalsProps {
  // Form modal
  formTarget: MailFormTarget | null;
  formType: MailType;
  editingMail: IIncomingMail | IOutgoingMail | null | undefined;
  allowedCreateTypes: MailType[];
  counterpartyOptions: string[];
  candidates: MailCandidateLookup | undefined;
  parentEdges: ParentEdgeIndex | undefined;
  canLinkCurrent: boolean;
  saving: boolean;
  onCloseForm: () => void;
  onTypeChange: (type: MailType) => void;
  onSave: (type: MailType, form: MailFormState, parentKey: MailNodeKey | null) => void;
  onOpenThread: (type: MailType, id: string) => void;

  // Files modal
  filesFor: string | null;
  canManageFiles: boolean;

  // History modal
  historyFor: string | null;
  createdByName: string | undefined;
  createdAt: string | undefined;

  // Thread builder
  threadTarget: ThreadTarget | null;
  onGoToRegister: (mailId: string, mailType: MailType, dateKey: string) => void;

  // Column settings
  visibleColumns: MailColumnId[];

  // Delete modal
  deleteMailSubject: ReactNode;
  deleteReason: string;
  closeDeleteModal: () => void;
  confirmDelete: () => void;

  orgId: string;
  tab: MailType;
  permissions: MailPermissions;
  objectNames: Map<string, string>;
  responsibleOptions: Array<{ id: string; name: string }>;
  labelFor: (mailId: string | null) => string;
  columnSettingsOpen: boolean;
  handleColumnChange: (columns: MailColumnId[]) => void;
  setColumnSettingsOpen: Dispatch<SetStateAction<boolean>>;
  deleteFor: string | null;
  deleteIncoming: { isPending: boolean };
  deleteOutgoing: { isPending: boolean };
  setDeleteReason: Dispatch<SetStateAction<string>>;
  setFilesFor: Dispatch<SetStateAction<string | null>>;
  setHistoryFor: Dispatch<SetStateAction<string | null>>;
  setThreadTarget: Dispatch<SetStateAction<ThreadTarget | null>>;
}

/**
 * Корневой контейнер модальных окон раздела переписки.
 * Композиция дочерних модальных компонентов: форма, вспомогательные окна и удаление.
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
      {/* Форма создания/редактирования/копирования письма */}
      <MailSectionFormModal
        formTarget={formTarget}
        formType={formType}
        editingMail={editingMail}
        allowedCreateTypes={allowedCreateTypes}
        counterpartyOptions={counterpartyOptions}
        candidates={candidates}
        parentEdges={parentEdges}
        canLinkCurrent={canLinkCurrent}
        saving={saving}
        onCloseForm={onCloseForm}
        onTypeChange={onTypeChange}
        onSave={onSave}
        onOpenThread={onOpenThread}
        objectNames={objectNames}
        responsibleOptions={responsibleOptions}
      />

      {/* Вспомогательные окна: файлы, история, дерево переписки, настройки колонок */}
      <MailSectionAuxModals
        filesFor={filesFor}
        canManageFiles={canManageFiles}
        historyFor={historyFor}
        createdByName={createdByName}
        createdAt={createdAt}
        threadTarget={threadTarget}
        onGoToRegister={onGoToRegister}
        visibleColumns={visibleColumns}
        columnSettingsOpen={columnSettingsOpen}
        handleColumnChange={handleColumnChange}
        setColumnSettingsOpen={setColumnSettingsOpen}
        setFilesFor={setFilesFor}
        setHistoryFor={setHistoryFor}
        setThreadTarget={setThreadTarget}
        orgId={orgId}
        tab={tab}
        permissions={permissions}
        labelFor={labelFor}
      />

      {/* Подтверждение удаления письма */}
      <MailSectionDeleteModal
        deleteFor={deleteFor}
        deleteMailSubject={deleteMailSubject}
        deleteReason={deleteReason}
        setDeleteReason={setDeleteReason}
        closeDeleteModal={closeDeleteModal}
        confirmDelete={confirmDelete}
        deleteIncoming={deleteIncoming}
        deleteOutgoing={deleteOutgoing}
      />
    </>
  );
}