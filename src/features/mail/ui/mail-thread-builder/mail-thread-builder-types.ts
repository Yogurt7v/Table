import type { MailType } from '@/shared/types';
import type { MailNodeKey } from '@/features/mail/model/mail-thread';
import type { MailPermissions } from '@/features/mail/model/mail-field-access';

/** Пропсы конструктора переписки. */
export interface MailThreadBuilderProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  rootMailId: string;
  rootMailType: MailType;
  permissions: MailPermissions;
  onGoToRegister?: (mailId: string, mailType: MailType, dateKey: string) => void;
}

/** Письмо, чьи подписи пришли с сброса и которого в графе уже нет. */
export interface DetachedLetter {
  readonly key: MailNodeKey;
  readonly type: MailType;
  readonly id: string;
}
