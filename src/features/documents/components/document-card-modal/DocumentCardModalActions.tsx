import { Button, Group, Paper, Text } from '@mantine/core';
import { IconArchive, IconRefresh } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { IDocument } from '@/shared/types';

/** Пропсы панели действий над документом. */
export interface DocumentCardModalActionsProps {
  document: IDocument;
  canArchive: boolean;
  isAdmin: boolean;
  cancelling: boolean;
  onArchive: () => void;
  onTogglePaymentCancelled: () => void;
}

/**
 * Панель действий: перемещение в архив, отмена/возобновление оплаты
 * и дата создания документа.
 */
export function DocumentCardModalActions({
  document,
  canArchive,
  isAdmin,
  cancelling,
  onArchive,
  onTogglePaymentCancelled,
}: DocumentCardModalActionsProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" wrap="wrap" gap="md">
        <Group>
          {canArchive && (
            <Button
              color="orange"
              variant="light"
              leftSection={<IconArchive size={16} />}
              onClick={onArchive}
            >
              В архив
            </Button>
          )}
          {isAdmin && (
            <Button
              color={document.payment_cancelled ? 'green' : 'red'}
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={onTogglePaymentCancelled}
              loading={cancelling}
            >
              {document.payment_cancelled ? 'Возобновить оплату' : 'Отменить оплату'}
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          Создан {document.created ? dayjs(document.created).format('DD.MM.YYYY HH:mm') : '—'}
        </Text>
      </Group>
    </Paper>
  );
}
