import type { Dispatch, SetStateAction } from 'react';
import type { MailType } from '@/shared/types';
import type { MailColumnId } from '@/features/mail/mail-columns';
import type { MailPermissions } from '@/features/mail/mail-field-access';

/**
 * Что открыто в форме письма. У копии запоминается регистр источника
 * (`sourceType`): после переключения регистра письмо остаётся в прежней
 * коллекции, и его id в новой не существует — без этого признака запрос
 * деталей уходил бы в чужую коллекцию и получал 404.
 */
export type MailFormTarget =
  | { mode: 'create' }
  | { mode: 'edit'; mailId: string }
  | { mode: 'copy'; mailId: string; sourceType: MailType };

/** Корень дерева переписки с указанием регистра: родитель может быть из другого. */
export type MailThreadTarget = { mailId: string; mailType: MailType };

/** Модалка файлов письма: открыта, пока выбран id письма. */
export interface MailFilesDialogProps {
  filesFor: string | null;
  setFilesFor: Dispatch<SetStateAction<string | null>>;
  canManageFiles: boolean;
  orgId: string;
  tab: MailType;
  /** Подпись письма для заголовка окна. */
  labelFor: (mailId: string | null) => string;
}

/** Модалка истории изменений письма. */
export interface MailHistoryDialogProps {
  historyFor: string | null;
  setHistoryFor: Dispatch<SetStateAction<string | null>>;
  createdByName: string | undefined;
  createdAt: string | undefined;
  orgId: string;
  tab: MailType;
  labelFor: (mailId: string | null) => string;
}

/** Дерево переписки выбранного письма. */
export interface MailThreadDialogProps {
  threadTarget: MailThreadTarget | null;
  setThreadTarget: Dispatch<SetStateAction<MailThreadTarget | null>>;
  orgId: string;
  tab: MailType;
  permissions: MailPermissions;
  onGoToRegister: (mailId: string, mailType: MailType, dateKey: string) => void;
}

/** Настройка состава и порядка колонок таблицы. */
export interface MailColumnsDialogProps {
  visibleColumns: MailColumnId[];
  columnSettingsOpen: boolean;
  setColumnSettingsOpen: Dispatch<SetStateAction<boolean>>;
  handleColumnChange: (columns: MailColumnId[]) => void;
  permissions: MailPermissions;
  tab: MailType;
}
