import { useQuery } from '@tanstack/react-query';
import { Loader, Modal, Paper, Stack, Text } from '@mantine/core';
import { getDeletedIncomingMailHistory, getDeletedOutgoingMailHistory } from '@/api/mail';
import type { IDeletedMailHistory, MailType } from '@/shared/types';
import { formatMailTimestamp } from './mail-date';
import { MAIL_HISTORY_TYPE_LABELS } from './mail-labels';
import { buildMailHistoryEntries } from './mail-history';

interface DeletedMailHistoryModalProps {
  deletedMailId: string;
  mailType: MailType;
  mailLabel: string;
  onClose: () => void;
}

/**
 * История архивной записи — `deleted_mail_history`, отдельная коллекция.
 *
 * Вынесено из бывшего `MailArchiveModal`: сам архив теперь секция админки, но
 * просмотр истории одной записи по-прежнему детальный вид, поэтому остаётся
 * модалкой.
 */
export function DeletedMailHistoryModal({
  deletedMailId,
  mailType,
  mailLabel,
  onClose,
}: DeletedMailHistoryModalProps) {
  const query = useQuery({
    queryKey: ['deletedMailHistory', mailType, deletedMailId],
    queryFn: () =>
      mailType === 'incoming'
        ? getDeletedIncomingMailHistory(deletedMailId)
        : getDeletedOutgoingMailHistory(deletedMailId),
    enabled: !!deletedMailId,
  });

  const entries = buildMailHistoryEntries((query.data ?? []) as IDeletedMailHistory[]);

  return (
    <Modal opened onClose={onClose} title={`История архива: ${mailLabel}`} size="lg">
      {query.isLoading && <Loader size="sm" />}
      {!query.isLoading && entries.length === 0 && <Text c="dimmed">Записей нет</Text>}
      {!query.isLoading && entries.length > 0 && (
        <Stack gap="xs">
          {entries.map((entry) => (
            <Paper key={entry.entryId} withBorder p="xs" radius="sm">
              <Text size="sm">{MAIL_HISTORY_TYPE_LABELS[entry.type]}</Text>
              <Text size="xs" c="dimmed" mt={2}>
                {`${formatMailTimestamp(entry.changedAt)} · ${entry.author}`}
              </Text>
            </Paper>
          ))}
        </Stack>
      )}
    </Modal>
  );
}
