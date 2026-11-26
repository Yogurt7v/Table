import { useRef, useState } from 'react';
import { ActionIcon, Button, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import {
  IconCloudUpload,
  IconFile,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypeXls,
  IconFileTypeZip,
  IconPhoto,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

/** Пропсы универсальной зоны выбора и загрузки файлов. */
export interface FilesDropZoneProps {
  /** Выбранные файлы — состояние родителя. */
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Сколько файлов помещается в очередь; без значения — без ограничения. */
  maxFiles?: number;
  /** Если передан, рисуется кнопка «Загрузить» и вызывает его с очередью. */
  onUpload?: (files: File[]) => void;
  /** Блокирует выбор и очередь (например, пока отправляется форма). */
  disabled?: boolean;
  /** Идёт загрузка: блокирует выбор, очередь и кнопку. */
  uploading?: boolean;
  /** Пояснение над зоной, например о том, когда файлы будут загружены. */
  hint?: string;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/** Иконка по расширению файла: одна для очереди и для списков у вызывающих. */
export function FileTypeIcon({ name, size = 18 }: { name: string; size?: number }) {
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

/**
 * Зона выбора файлов: drag&drop, кнопка выбора, очередь выбранных и — если
 * передан `onUpload` — кнопка загрузки. Состояние очереди держит родитель,
 * а загрузку и тосты об успехе/ошибке выполняет он же.
 */
export function FilesDropZone({
  files,
  onFilesChange,
  maxFiles,
  onUpload,
  disabled = false,
  uploading = false,
  hint,
}: FilesDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining =
    maxFiles === undefined ? Number.POSITIVE_INFINITY : Math.max(0, maxFiles - files.length);
  const dropDisabled = disabled || uploading || remaining === 0;
  const uploadDisabled = files.length === 0 || disabled || uploading;

  // Свободных мест может не хватить на всю пачку: лишние отбрасываются с тостом.
  const acceptFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    if (incoming.length === 0) return;

    const freeSlots =
      maxFiles === undefined ? incoming.length : Math.max(0, maxFiles - files.length);
    const batch = incoming.slice(0, freeSlots);
    const dropped = incoming.length - batch.length;

    if (dropped > 0) {
      notifications.show({
        color: 'yellow',
        title: 'Часть файлов не добавлена',
        message:
          freeSlots === 0
            ? `Достигнут лимит: ${maxFiles} файлов.`
            : `Можно добавить ещё ${freeSlots} файл(ов), остальные ${dropped} пропущены.`,
      });
    }
    if (batch.length === 0) return;
    onFilesChange([...files, ...batch]);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (dropDisabled) return;
    acceptFiles(event.dataTransfer.files);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptFiles(event.target.files);
    event.target.value = '';
  };

  const dropTitle =
    remaining === 0
      ? 'Лимит файлов исчерпан'
      : dragging
        ? 'Отпустите файлы здесь'
        : 'Перетащите файлы или нажмите для выбора';

  return (
    <Stack gap="sm">
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}

      {/* ── Зона drag&drop и выбора ─────────────────────────────── */}
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
            {dropTitle}
          </Text>
          {!dropDisabled && maxFiles !== undefined && (
            <Text size="xs" c="dimmed">
              Можно выбрать до {remaining} файл(ов) за раз
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

      {/* ── Очередь выбранных файлов ───────────────────────────── */}
      {files.length > 0 && (
        <Stack gap={6}>
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed" fw={500}>
              К загрузке · {files.length}
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<IconX size={12} />}
              onClick={() => onFilesChange([])}
              disabled={uploading || disabled}
            >
              Очистить
            </Button>
          </Group>

          {files.map((file, index) => (
            <Paper key={`${file.name}-${file.size}-${index}`} withBorder p="xs" radius="sm">
              <Group gap="sm" wrap="nowrap">
                <FileTypeIcon name={file.name} />
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" truncate title={file.name}>
                    {file.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {onUpload
                      ? `${formatBytes(file.size)} · будет загружен после нажатия «Загрузить»`
                      : formatBytes(file.size)}
                  </Text>
                </Stack>
                <Tooltip label="Убрать из списка">
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="subtle"
                    aria-label="Убрать файл из списка"
                    disabled={uploading || disabled}
                    onClick={() => onFilesChange(files.filter((_, i) => i !== index))}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      {/* ── Кнопка загрузки (только когда родитель умеет грузить) ─ */}
      {onUpload && (
        <Button
          leftSection={<IconUpload size={14} />}
          disabled={uploadDisabled}
          loading={uploading}
          onClick={() => onUpload(files)}
          fullWidth
        >
          {files.length > 0 ? `Загрузить (${files.length})` : 'Загрузить'}
        </Button>
      )}
    </Stack>
  );
}
