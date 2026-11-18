import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Center,
  FileButton,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconFile, IconPaperclip, IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import { getDocumentFileUrl } from '@/api/documents';
import type { IDocument, IDocumentFile } from '@/shared/types';

/** Пропсы вкладки «Файлы». */
export interface DocumentCardModalFilesProps {
  document: IDocument;
  files: IDocumentFile[];
  loading: boolean;
  canUpload: boolean;
  canDeleteFile: (file: IDocumentFile) => boolean;
  selectedFile: File | null;
  uploading: boolean;
  onSelectFile: (file: File | null) => void;
  onRequestDelete: (file: IDocumentFile) => void;
  onUpload: () => void;
}

/**
 * Вкладка «Файлы»: список файлов документа с удалением,
 * форма загрузки нового файла и пустое состояние.
 */
export function DocumentCardModalFiles({
  document,
  files,
  loading,
  canUpload,
  canDeleteFile,
  selectedFile,
  uploading,
  onSelectFile,
  onRequestDelete,
  onUpload,
}: DocumentCardModalFilesProps) {
  return (
    <Stack gap="md">
      {/* Список файлов или пустое состояние */}
      {loading ? (
        <Loader size="sm" />
      ) : files.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
              <IconPaperclip size={24} />
            </ThemeIcon>
            <Text c="dimmed" size="sm">
              Файлов нет
            </Text>
          </Stack>
        </Center>
      ) : (
        files.map((file) => (
          <Paper key={file.id} withBorder p="sm" radius="md">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <ThemeIcon size="md" variant="light" color="blue" radius="md">
                  <IconFile size={16} />
                </ThemeIcon>
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Anchor
                    href={getDocumentFileUrl(file)}
                    target="_blank"
                    rel="noreferrer"
                    size="sm"
                  >
                    <Text size="sm" fw={500} truncate>
                      {file.name}
                    </Text>
                  </Anchor>
                  <Group gap="xs" wrap="wrap">
                    <Text size="xs" c="dimmed">
                      {file.uploaded_by_name || '—'}
                    </Text>
                    {file.id === document.confirmed_file_id && (
                      <Badge size="xs" color="green" variant="light">
                        Подтверждающий
                      </Badge>
                    )}
                  </Group>
                </Stack>
              </Group>
              <Group gap="xs" wrap="nowrap">
                {canDeleteFile(file) && (
                  <Tooltip label="Удалить файл">
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      aria-label="Удалить файл"
                      onClick={() => onRequestDelete(file)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Group>
          </Paper>
        ))
      )}

      {/* Форма загрузки: выбор файла и кнопка «Загрузить» */}
      {canUpload && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <FileButton onChange={onSelectFile}>
              {(props) => (
                <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
                  Выбрать файл
                </Button>
              )}
            </FileButton>
            {selectedFile && (
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
                  {selectedFile.name}
                </Text>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label="Снять выбор файла"
                  onClick={() => onSelectFile(null)}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            )}
            <Button
              leftSection={<IconUpload size={16} />}
              disabled={!selectedFile}
              loading={uploading}
              onClick={onUpload}
            >
              Загрузить
            </Button>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
