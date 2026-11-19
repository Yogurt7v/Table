/** Публичные типы хуков почтовой корреспонденции: параметры списков и переменные мутаций. */

import type { IIncomingMail, IOutgoingMail, MailListParams, MailType } from '@/shared/types';

/** Параметры запроса списка писем без идентификатора организации (он передаётся отдельно). */
export type MailListQuery = Omit<MailListParams, 'organizationId'>;

/** Переменные обновления входящего письма; `previousData` сохраняется в истории до применения изменений. */
export type UpdateIncomingMailVars = {
  id: string;
  data: Partial<IIncomingMail>;
  /** Снимок предыдущих данных для записи в `mail_history` на уровне API. */
  previousData: Record<string, unknown>;
};

/** Переменные обновления исходящего письма; `previousData` сохраняется в истории до применения изменений. */
export type UpdateOutgoingMailVars = {
  id: string;
  data: Partial<IOutgoingMail>;
  previousData: Record<string, unknown>;
};

/** Переменные удаления письма: причина обязательна и передаётся вызывающим кодом. */
export type DeleteMailVars = {
  id: string;
  reason: string;
};

/** Переменные загрузки вложений в письмо. */
export type UploadMailFilesVars = {
  mailId: string;
  mailType: MailType;
  files: File[];
};

/** Переменные создания связи между письмами одного типа/реестра. */
export type CreateMailRelationVars = {
  parentId: string;
  childId: string;
  mailType: MailType;
};

/** Переменные удаления связи между письмами. */
export type DeleteMailRelationVars = {
  relationId: string;
  mailType: MailType;
};
