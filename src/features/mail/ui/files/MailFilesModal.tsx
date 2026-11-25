import { useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconCloudUpload,
  IconFile,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypeXls,
  IconFileTypeZip,
  IconPhoto,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDeleteMailFile, useMailFiles, useUploadMailFiles } from '@/shared/hooks/useMail';
import { getMailFileUrl } from '@/api/mail';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { IMailFile, MailType } from '@/shared/types';
import { formatMailTimestamp } from '@/features/mail/model/mail-date';

/** Поле `file` в `mail_files` — multiple, коллекция ограничивает запись десятью. */
const MAX_FILES = 30;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

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

function FileIcon({ name, size = 18 }: { name: string; size?: number }) {
  const ext = extensionOf(name);
  const props = { size } as const;
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'csv'].includes(ext))
    return <IconFileTypeDoc {...props} />;
  if (['xls', 'xlsx', 'ods'].includes(ext)) return <IconFileTypeXls {...props} />;
  if (['ppt', 'pptx', 'odp', 'pdf'].includes(ext)) return <IconFileTypePdf {...props} />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <IconFileTypeZip {...props} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext))
    return <IconPhoto {...props} />;
  return <IconFile {...props} />;
}

interface MailFilesModalProps {
  mailId: string | null;
  mailType: MailType;
  mailLabel: string;
  orgId: string;
  opened: boolean;
  canManageFiles: boolean;
  onClose: () => void;
}

export default function MailFilesModal({
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
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const resetPicked = () => setPicked([]);

  const acceptFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    if (incoming.length === 0) return;

    const freeSlots = Math.max(0, remaining - picked.length);
    const batch = incoming.slice(0, freeSlots);
    const dropped = incoming.length - batch.length;

    if (dropped > 0) {
      notifications.show({
        color: 'yellow',
        title: 'Часть файлов не добавлена',
        message:
          freeSlots === 0
            ? `Достигнут лимит: ${MAX_FILES} вложений на письмо.`
            : `Можно добавить ещё ${freeSlots} файл(ов), остальные ${dropped} пропущены.`,
      });
    }
    if (batch.length === 0) return;
    setPicked((prev) => [...prev, ...batch]);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (remaining - picked.length === 0 || upload.isPending) return;
    acceptFiles(event.dataTransfer.files);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptFiles(event.target.files);
    event.target.value = '';
  };

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

  const dropDisabled = remaining === 0 || upload.isPending;

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
                <FileIcon name={originalName} />
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

      {/* ── Дропзона + выбранные файлы ─────────────────────────── */}
      {canManageFiles && (
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            {remaining === 0
              ? `Достигнут лимит: ${MAX_FILES} вложений`
              : `Можно прикрепить ещё ${remaining - picked.length} из ${MAX_FILES}`}
          </Text>

          <Paper
            withBorder
            p="lg"
            radius="md"
            onDragOver={(e) => {
              e.preventDefault();
              if (!dropDisabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !dropDisabled && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-disabled={dropDisabled}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !dropDisabled) inputRef.current?.click();
            }}
            style={{
              cursor: dropDisabled ? 'not-allowed' : 'pointer',
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: dragging ? 'var(--mantine-color-blue-5)' : undefined,
              backgroundColor: dragging ? 'var(--mantine-color-blue-light)' : undefined,
              opacity: dropDisabled ? 0.6 : 1,
              transition: 'border-color 120ms ease, background-color 120ms ease',
              textAlign: 'center',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="*/*"
              onChange={handleInputChange}
              style={{ display: 'none' }}
              disabled={dropDisabled}
            />
            <Stack align="center" gap={6}>
              <IconCloudUpload
                size={36}
                color={dragging ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-5)'}
              />
              <Text fw={600} size="sm">
                {dropDisabled
                  ? 'Лимит вложений исчерпан'
                  : dragging
                    ? 'Отпустите файлы здесь'
                    : 'Перетащите файлы или нажмите для выбора'}
              </Text>
              {!dropDisabled && (
                <Text size="xs" c="dimmed">
                  Можно выбрать до {remaining - picked.length} файл(ов) за раз
                </Text>
              )}
              <Button
                variant="light"
                size="xs"
                leftSection={<IconUpload size={14} />}
                disabled={dropDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                mt={4}
              >
                Выбрать файлы
              </Button>
            </Stack>
          </Paper>

          {picked.length > 0 && (
            <Stack gap={6}>
              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed" fw={500}>
                  К загрузке · {picked.length}
                </Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconX size={12} />}
                  onClick={resetPicked}
                  disabled={upload.isPending}
                >
                  Очистить
                </Button>
              </Group>

              {picked.map((file, index) => (
                <Paper key={`${file.name}-${file.size}-${index}`} withBorder p="xs" radius="sm">
                  <Group gap="sm" wrap="nowrap">
                    <FileIcon name={file.name} />
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" truncate title={file.name}>
                        {file.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatBytes(file.size)} · будет загружен после нажатия «Загрузить»
                      </Text>
                    </Stack>
                    <Tooltip label="Убрать из списка">
                      <ActionIcon
                        size="sm"
                        color="red"
                        variant="subtle"
                        aria-label="Убрать файл из списка"
                        disabled={upload.isPending}
                        onClick={() => setPicked((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}

          <Button
            leftSection={<IconUpload size={14} />}
            disabled={picked.length === 0}
            loading={upload.isPending}
            onClick={handleUpload}
            fullWidth
          >
            {picked.length > 0 ? `Загрузить (${picked.length})` : 'Загрузить'}
          </Button>
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
