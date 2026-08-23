import { Modal, Text, Group, Button } from '@mantine/core';

interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  color?: string;
  loading?: boolean;
}

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  color = 'red',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm">
      <Text mb="lg">{message}</Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button color={color} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
