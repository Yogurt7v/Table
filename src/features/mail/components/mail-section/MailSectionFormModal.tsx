import { MailFormModal } from '@/features/mail/MailFormModal';
import type { MailFormState } from '@/features/mail/mail-form';
import type { MailCandidateLookup, ParentEdgeIndex } from '@/features/mail/mail-parent';
import type { MailNodeKey } from '@/features/mail/mail-thread';
import type { IIncomingMail, IOutgoingMail, MailType } from '@/shared/types';
import type { MailFormTarget } from './mail-section-types';

/** Пропсы формы письма: цель открытия, регистр и обработчики сохранения. */
export interface MailSectionFormModalProps {
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
  objectNames: Map<string, string>;
  responsibleOptions: Array<{ id: string; name: string }>;
}

/**
 * Форма создания, редактирования и копирования письма.
 * Рендерит модальное окно формы, связывает поля с данными организации и обработчиками сохранения/переходов.
 */
export function MailSectionFormModal({
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
  objectNames,
  responsibleOptions,
}: MailSectionFormModalProps) {
  return (
    <>
      {/* Единственная модалка формы: открыта, пока в MailSection задан formTarget */}
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
        onOpenThread={onOpenThread}
      />
    </>
  );
}
