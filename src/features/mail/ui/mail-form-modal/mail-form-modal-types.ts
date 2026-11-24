import type { IIncomingMail, IOutgoingMail, MailType } from '@/shared/types';
import type { MailNodeKey } from '@/features/mail/model/mail-thread';
import type { MailFormState } from '@/features/mail/model/mail-form';
import type { MailCandidateLookup, ParentEdgeIndex } from '@/features/mail/model/mail-parent';

export interface MailFormModalProps {
  opened: boolean;
  onClose: () => void;
  mailType: MailType;
  /** Редактируемое письмо; `null` — создание. */
  mail: IIncomingMail | IOutgoingMail | null;
  /**
   * Копия: форма наполняется чужим письмом, но сохраняется как новое — без номера
   * и без связей, чтобы не задвоить запись и не встроить копию в чужую переписку.
   */
  copying?: boolean;
  /** Регистры, которые пользователю разрешено создавать, — для переключателя. */
  allowedTypes: MailType[];
  accountingObjects: { value: string; label: string }[];
  responsibleOptions: { value: string; label: string }[];
  /** Контрагенты организации для подсказок — общий словарь обеих вкладок. */
  counterpartyOptions: string[];
  saving: boolean;
  /** Связи организации: кандидаты в родители и уже записанные связи. */
  candidates: MailCandidateLookup | undefined;
  parentEdges: ParentEdgeIndex | undefined;
  /** Право назвать или снять родителя: при создании — «создавать», при правке — «редактировать». */
  canLink: boolean;
  onTypeChange: (mailType: MailType) => void;
  onSave: (mailType: MailType, form: MailFormState, parentKey: MailNodeKey | null) => void;
  onOpenThread: (mailType: MailType, mailId: string) => void;
}
