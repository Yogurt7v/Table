import { useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Button,
  FileButton,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import { IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDeleteMailFile, useMailFiles, useUploadMailFiles } from '@/shared/hooks/useMail';
import { getMailFileUrl } from '@/api/mail';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { IMailFile, MailType } from '@/shared/types';
import { formatMailTimestamp } from './mail-date';

/** Поле `file` в `mail_files` — multiple, коллекция ограничивает запись десятью. */
const MAX_FILES = 10;

interface MailFilesModalProps {
  mailId: string | null;
  mailType: MailType;
  mailLabel: string;
  orgId: string;
  opened: boolean;
  canManageFiles: boolean;
  onClose: () => void;
}

/**
 * Вложения письма. Ключ `mail_files` — текстовый `mail_id` плюс `mail_type`,
 * а не связь: поэтому вложения переживают удаление письма и восстановление из
 * архива под тем же id. `expand` здесь невозможен, поэтому список запрашивается
 * фильтром по этой паре — так же, как это делает `getMailFiles`.
 */
export function MailFilesModal({
  mailId,
  mailType,
  mailLabel,
  orgId,
  opened,
  canManageFiles,
  onClose,
}: MailFilesModalProps) {
  const id = opened && mailId ? mailId : '';
  const [picked, setPicked] = useState<File[]>([]);
  const [fileToDelete, setFileToDelete] = useState<IMailFile | null>(null);

  const { data: files, isLoading } = useMailFiles(id, mailType);
  const upload = useUploadMailFiles(orgId);
  const remove = useDeleteMailFile(orgId);

  const existing = (files ?? []).map((file) => ({ file, url: getMailFileUrl(file) }));
  const remaining = Math.max(0, MAX_FILES - existing.length);

  const resetPicked = () => setPicked([]);

  const handleUpload = async () => {
    if (!mailId || picked.length === 0) return;
    const batch = picked.slice(0, remaining);
    try {
      await upload.mutateAsync({ mailId, mailType, files: batch });
      resetPicked();
      notifications.show({
        color: 'green',
        message: batch.length === 1 ? 'Вложение загружено' : `Загружено вложений: ${batch.length}`,
      });
    } catch {
      /* тост об ошибке показывает onError в useUploadMailFiles */
    }
  };

  const handleDelete = async (file: IMailFile) => {
    setFileToDelete(null);
    try {
      await remove.mutateAsync(file);
      notifications.show({ color: 'green', message: 'Вложение удалено' });
    } catch {
      /* тост об ошибке показывает onError в useDeleteMailFile */
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Вложения: ${mailLabel}`} size="md">
      {isLoading ? (
        <Loader size="sm" />
      ) : existing.length === 0 ? (
        <Text c="dimmed" mb="md">
          Вложений нет
        </Text>
      ) : (
        <Stack gap="sm" mb="md">
          {existing.map(({ file, url }) => (
            <Group key={file.id} gap="sm" wrap="nowrap">
              {url ? (
                <Anchor
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {file.name}
                </Anchor>
              ) : (
                <Text
                  size="sm"
                  c="dimmed"
                  style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {file.name} (файл недоступен)
                </Text>
              )}
              {file.created && (
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {formatMailTimestamp(file.created)}
                </Text>
              )}
              {canManageFiles && (
                <ActionIcon
                  size="sm"
                  color="red"
                  variant="subtle"
                  aria-label="Удалить вложение"
                  onClick={() => setFileToDelete(file)}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              )}
            </Group>
          ))}
        </Stack>
      )}

      {canManageFiles && (
        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            {`Можно прикрепить ещё ${remaining} из ${MAX_FILES}`}
          </Text>

          <FileButton
            multiple
            accept="*/*"
            onChange={(value) => setPicked(value ? value.slice(0, remaining) : [])}
            disabled={remaining === 0}
          >
            {(props) => (
              <Button
                {...props}
                variant="default"
                leftSection={<IconUpload size={14} />}
                disabled={remaining === 0 || upload.isPending}
                fullWidth
              >
                Выбрать файлы
              </Button>
            )}
          </FileButton>

          {picked.length > 0 && (
            <Stack gap={4}>
              {picked.map((file) => (
                <Group key={file.name} gap="xs" wrap="nowrap">
                  <Text
                    size="sm"
                    style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {file.name}
                  </Text>
                </Group>
              ))}
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                leftSection={<IconX size={12} />}
                onClick={resetPicked}
                style={{ alignSelf: 'flex-start' }}
              >
                Очистить выбор
              </Button>
            </Stack>
          )}

          <Button
            leftSection={<IconUpload size={14} />}
            disabled={picked.length === 0}
            loading={upload.isPending}
            onClick={handleUpload}
            fullWidth
          >
            Загрузить
          </Button>
        </Stack>
      )}

      {!canManageFiles && existing.length > 0 && (
        <Text size="xs" c="dimmed" mt="sm">
          Просмотр вложений доступен, изменение — только тем, кто может редактировать письма.
        </Text>
      )}

      <ConfirmModal
        opened={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={() => {
          if (fileToDelete) handleDelete(fileToDelete);
        }}
        title="Удаление вложения"
        message={`Удалить вложение «${fileToDelete?.name ?? ''}»?`}
        loading={remove.isPending}
      />
    </Modal>
  );
}
