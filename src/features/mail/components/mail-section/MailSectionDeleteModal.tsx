import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Group, Text, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { ConfirmModal } from '@/shared/components/ConfirmModal';

export interface MailSectionDeleteModalProps {
  deleteFor: string | null;
  deleteMailSubject: ReactNode;
  deleteReason: string;
  setDeleteReason: Dispatch<SetStateAction<string>>;
  closeDeleteModal: () => void;
  confirmDelete: () => void;
  deleteIncoming: { isPending: boolean };
  deleteOutgoing: { isPending: boolean };
}

/**
 * Модальное окно подтверждения удаления письма.
 * Рендерит карточку удаляемого письма, поле причины и кнопки подтверждения/отмены.
 */
export function MailSectionDeleteModal({
  deleteFor,
  deleteMailSubject,
  deleteReason,
  setDeleteReason,
  closeDeleteModal,
  confirmDelete,
  deleteIncoming,
  deleteOutgoing,
}: MailSectionDeleteModalProps) {
  return (
    /* Подтверждение удаления: карточка письма + обязательная причина */
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
  );
}
