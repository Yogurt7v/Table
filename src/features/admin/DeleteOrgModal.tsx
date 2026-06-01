import { useState } from 'react';
import { Modal, Stack, Text, TextInput, Group, Button } from '@mantine/core';

interface DeleteOrgModalProps {
  opened: boolean;
  orgName: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteOrgModal({ opened, orgName, isPending, onClose, onConfirm }: DeleteOrgModalProps) {
  const [confirmText, setConfirmText] = useState('');

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    setConfirmText('');
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`Удаление организации «${orgName}»`}
      size="sm"
    >
      <Stack onKeyDown={(e) => {
        if (e.key === 'Enter' && confirmText === 'я осознаю последствия') {
          e.preventDefault();
          handleConfirm();
        }
      }}>
        <Text size="sm">
          Это действие необратимо. Все счета, данные и настройки организации будут удалены.
        </Text>
        <Text size="sm" fw={500}>
          Введите «я осознаю последствия» для подтверждения:
        </Text>
        <TextInput
          value={confirmText}
          onChange={(e) => setConfirmText(e.currentTarget.value)}
          placeholder="я осознаю последствия"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleClose} disabled={isPending}>
            Отмена
          </Button>
          <Button
            color="red"
            disabled={confirmText !== 'я осознаю последствия' || isPending}
            loading={isPending}
            onClick={handleConfirm}
          >
            Удалить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
