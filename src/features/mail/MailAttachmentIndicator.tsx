import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';
import { IconPaperclip } from '@tabler/icons-react';
import type { MailRow } from './mail-row';

interface MailAttachmentIndicatorProps {
  row: MailRow;
  /** Строка вклада в скринридер: в таблице — с номером письма, в карточке — без него. */
  ariaLabel: string;
  onOpenFiles: (mailId: string) => void;
}

function tooltipLabel(row: MailRow): string {
  if (row.attachmentCount === 0) return 'Вложения';
  if (row.attachmentNames.length === 0) return `Вложений: ${row.attachmentCount}`;
  return [`Вложений: ${row.attachmentCount}`, ...row.attachmentNames].join('\n');
}

/**
 * Индикатор вложений письма — один на таблицу и на карточки, чтобы обе раскладки
 * не разошлись. Скринпин: в ячейке рядом со скрепкой печатается имя первого
 * вложения, остальные сворачиваются в «+N» — письмо с десятью файлами не должно
 * растягивать строку реестра, а полный список всё равно в одном наведении и в
 * модалке. Имя приходит из `mail_files.name`, то есть это исходное имя файла, а
 * не сгенерированное хранилищем.
 */
export function MailAttachmentIndicator({
  row,
  ariaLabel,
  onOpenFiles,
}: MailAttachmentIndicatorProps) {
  const hasAttachments = row.attachmentCount > 0;
  // const [firstName] = row.attachmentNames;
  // const hiddenCount = row.attachmentNames.length - 1;

  return (
    <Tooltip
      multiline
      maw={280}
      label={tooltipLabel(row)}
      styles={{ tooltip: { whiteSpace: 'pre-line' } }}
    >
      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
        <ActionIcon
          size="sm"
          style={{ flexShrink: 0 }}
          variant={hasAttachments ? 'light' : 'subtle'}
          color={hasAttachments ? 'blue' : 'gray'}
          aria-label={ariaLabel}
          onClick={() => onOpenFiles(row.id)}
        >
          <IconPaperclip size={16} />
        </ActionIcon>
        {/*{firstName && (
          <>
            <Text
              size="xs"
              c="dimmed"
              lineClamp={1}
              title={firstName}
              style={{ flex: 1, minWidth: 0 }}
            >
              {firstName}
            </Text>
            {hiddenCount > 0 && (
              <Text size="xs" c="dimmed" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {`+${hiddenCount}`}
              </Text>
            )}
          </>
        )}*/}
      </Group>
    </Tooltip>
  );
}
