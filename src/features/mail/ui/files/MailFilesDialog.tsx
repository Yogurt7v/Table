import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDeleteMailFile, useMailFiles, useUploadMailFiles } from '@/shared/hooks/useMail';
import { getMailFileUrl } from '@/api/mail';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { FilesDropZone, FileTypeIcon } from '@/shared/components/FilesDropZone';
import type { IMailFile, MailType } from '@/shared/types';
import { formatMailTimestamp } from '@/features/mail/model/mail-date';

/**
 * Ограничение на письмо: одна запись `mail_files` хранит до десяти файлов,
 * но записей может быть несколько — на письмо допускаем тридцать вложений.
 */
const MAX_FILES = 30;

/**
 * Достаёт оригинальное имя файла из записи, если бэкенд его отдаёт.
 * PocketBase переименовывает файлы при сохранении, поэтому `file.name`
 * может быть нормализованным. Поддерживаем несколько возможных имён поля,
 * чтобы компонент не ломался при смене бэкенда.
 */
function getOriginalFileName(file: IMailFile): string {
  const record = file as unknown as Record<string, unknown>;
  const candidates = ['originalName', 'original_name', 'originalFilename', 'original_filename'];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return file.name;
}

interface MailFilesDialogProps {
  mailId: string | null;
  mailType: MailType;
  mailLabel: string;
  orgId: string;
  opened: boolean;
  canManageFiles: boolean;
  onClose: () => void;
}

/**
 * Модалка вложений письма: список уже загруженных файлов с удалением и
 * универсальная зона выбора/загрузки новых. Загрузку и удаление выполняют
 * хуки почты, поэтому `FilesDropZone` здесь только про выбор файлов.
 */
export default function MailFilesDialog({
  mailId,
  mailType,
  mailLabel,
  orgId,
  opened,
  canManageFiles,
  onClose,
}: MailFilesDialogProps) {
  const id = opened && mailId ? mailId : '';
  const [picked, setPicked] = useState<File[]>([]);
  const [fileToDelete, setFileToDelete] = useState<IMailFile | null>(null);

  const { data: files, isLoading } = useMailFiles(id, mailType);
  const upload = useUploadMailFiles(orgId);
  const remove = useDeleteMailFile(orgId);

  const existing = useMemo(
    () =>
      (files ?? []).map((file) => {
        const url = getMailFileUrl(file);
        const originalName = getOriginalFileName(file);
        return { file, url, originalName };
      }),
    [files],
  );
  const remaining = Math.max(0, MAX_FILES - existing.length);
  const totalCount = existing.length + picked.length;

  const handleUpload = async () => {
    if (!mailId || picked.length === 0) return;
    const batch = picked.slice(0, remaining);
    if (batch.length === 0) return;
    try {
      await upload.mutateAsync({ mailId, mailType, files: batch });
      setPicked([]);
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

  /**
   * Скачивание с сохранением оригинального имени. Атрибут `download` у ссылки
   * браузеры игнорируют для кросс-доменных URL (фронт и PocketBase в dev на
   * разных портах), поэтому имя берётся из URL — нормализованное имя хранения,
   * а не исходное. Качаем файл через fetch, создаём blob-URL и кликаем по нему:
   * тогда имя файла — `originalName`. При ошибке (CORS/сеть) — запасной путь:
   * открыть файл в новой вкладке.
   */
  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Вложения: ${mailLabel}`} size="md">
      {/* ── Существующие вложения ─────────────────────────────── */}
      {isLoading ? (
        <Group gap="xs" mb="md">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Загружаем список вложений…
          </Text>
        </Group>
      ) : existing.length === 0 ? (
        <Text c="dimmed" mb="md">
          Вложений нет
        </Text>
      ) : (
        <Stack gap={6} mb="md">
          <Text size="xs" c="dimmed" fw={500}>
            Загружено · {existing.length} из {MAX_FILES}
          </Text>
          {existing.map(({ file, url, originalName }) => (
            <Paper key={file.id} withBorder p="xs" radius="sm">
              <Group gap="sm" wrap="nowrap">
                <FileTypeIcon name={originalName} />
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  {url ? (
                    <Anchor
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={originalName}
                      onClick={(event) => {
                        event.preventDefault();
                        void handleDownload(url, originalName);
                      }}
                      size="sm"
                      truncate
                      title={originalName}
                    >
                      {originalName}
                    </Anchor>
                  ) : (
                    <Text size="sm" c="dimmed" truncate title={originalName}>
                      {originalName}
                    </Text>
                  )}
                  <Text size="xs" c={url ? 'dimmed' : 'orange'}>
                    {url ? 'Скачать' : 'Файл недоступен'}
                    {file.created && ` · ${formatMailTimestamp(file.created)}`}
                  </Text>
                </Stack>
                {canManageFiles && (
                  <Tooltip label="Удалить вложение">
                    <ActionIcon
                      size="sm"
                      color="red"
                      variant="subtle"
                      aria-label="Удалить вложение"
                      onClick={() => setFileToDelete(file)}
                      disabled={remove.isPending}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      {/* ── Зона выбора и загрузки новых вложений ──────────────── */}
      {canManageFiles && (
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            {remaining === 0
              ? `Достигнут лимит: ${MAX_FILES} вложений`
              : `Можно прикрепить ещё ${Math.max(0, remaining - picked.length)} из ${MAX_FILES}`}
          </Text>

          <FilesDropZone
            files={picked}
            onFilesChange={setPicked}
            maxFiles={remaining}
            onUpload={handleUpload}
            uploading={upload.isPending}
          />
        </Stack>
      )}

      {!canManageFiles && existing.length > 0 && (
        <Text size="xs" c="dimmed" mt="sm">
          Просмотр вложений доступен, изменение — только тем, кто может редактировать письма.
        </Text>
      )}

      {!canManageFiles && existing.length === 0 && !isLoading && totalCount === 0 && (
        <Text size="xs" c="dimmed" mt="sm">
          Вложений нет.
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
