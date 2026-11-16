import { MailSectionFormModal, type MailSectionFormModalProps } from './MailSectionFormModal';
import { MailSectionAuxModals } from './MailSectionAuxModals';
import { MailSectionDeleteModal, type MailSectionDeleteModalProps } from './MailSectionDeleteModal';
import type {
  MailColumnsDialogProps,
  MailFilesDialogProps,
  MailHistoryDialogProps,
  MailThreadDialogProps,
} from './mail-section-types';

export interface MailSectionModalsProps {
  /** Форма создания/редактирования/копирования письма. */
  form: MailSectionFormModalProps;
  /** Файлы письма. */
  files: MailFilesDialogProps;
  /** История изменений письма. */
  history: MailHistoryDialogProps;
  /** Дерево переписки. */
  thread: MailThreadDialogProps;
  /** Настройка колонок таблицы. */
  columns: MailColumnsDialogProps;
  /** Подтверждение удаления письма. */
  deleteDialog: MailSectionDeleteModalProps;
}

/**
 * Корневой контейнер модальных окон раздела переписки.
 * Рендерит форму письма, вспомогательные окна (файлы, история, дерево, колонки)
 * и подтверждение удаления — по одному пропу-объекту на группу окон.
 */
export function MailSectionModals({
  form,
  files,
  history,
  thread,
  columns,
  deleteDialog,
}: MailSectionModalsProps) {
  return (
    <>
      {/* Форма создания/редактирования/копирования письма */}
      <MailSectionFormModal {...form} />

      {/* Вспомогательные окна: файлы, история, дерево переписки, настройки колонок */}
      <MailSectionAuxModals files={files} history={history} thread={thread} columns={columns} />

      {/* Подтверждение удаления письма */}
      <MailSectionDeleteModal {...deleteDialog} />
    </>
  );
}
