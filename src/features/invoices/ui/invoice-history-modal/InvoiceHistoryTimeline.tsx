import type { ReactNode } from 'react';
import { Anchor, Box, Group, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';
import {
  IconCircleCheckFilled,
  IconCopy,
  IconFlag,
  IconPaperclip,
  IconPencil,
  IconRotate,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { FIELD_LABELS } from './invoice-history-modal-constants';
import { formatHistoryValue } from './invoice-history-modal-utils';
import type { ActionKind, HistoryEntryDiffs } from './invoice-history-modal-types';

const ACTION_ICONS: Record<ActionKind, ReactNode> = {
  payment: <IconCircleCheckFilled size={14} />,
  payment_removed: <IconX size={14} />,
  copy_created: <IconCopy size={14} />,
  mark: <IconFlag size={14} />,
  edit: <IconPencil size={14} />,
  file_added: <IconPaperclip size={14} />,
  file_removed: <IconPaperclip size={14} />,
  invoice_deleted: <IconTrash size={14} />,
  invoice_restored: <IconRotate size={14} />,
};

interface InvoiceHistoryTimelineProps {
  entries: HistoryEntryDiffs[];
}

/**
 * Лента записей истории: иконка события, текст, карточки диффов и автор с
 * датой. Записи приходят уже отсортированными от новых к старым.
 */
export function InvoiceHistoryTimeline({ entries }: InvoiceHistoryTimelineProps) {
  // Лента: кружок с иконкой и соединительная линия между соседними записями.
  return (
    <Box ml={6}>
      {entries.map((item, index) => {
        const isLast = index === entries.length - 1;
        return (
          <Group key={item.entryId} gap={12} align="flex-start" wrap="nowrap">
            <Stack align="center" gap={0} mt={2} style={{ width: 20, alignSelf: 'stretch' }}>
              <Box
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '1px solid var(--mantine-color-gray-3)',
                  background: 'var(--mantine-color-gray-0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--mantine-color-gray-6)',
                  flexShrink: 0,
                }}
              >
                {ACTION_ICONS[item.kind]}
              </Box>
              {!isLast && (
                <Box
                  style={{
                    width: 1,
                    flex: 1,
                    background: 'var(--mantine-color-gray-2)',
                    minHeight: 28,
                  }}
                />
              )}
            </Stack>
            <Box pb={isLast ? 0 : 18} style={{ flex: 1, minWidth: 0 }}>
              {/* Текст события: у файла это ссылка на скачивание. */}
              <Group gap={6} wrap="nowrap" align="center">
                {item.fileLink ? (
                  <Anchor
                    href={item.fileLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    c="dark.4"
                  >
                    {item.actionText}
                  </Anchor>
                ) : (
                  <Text size="sm" c="dark.5" inline>
                    {item.actionText}
                  </Text>
                )}
              </Group>

              {/* Карточки диффов: подпись поля, зачёркнутое старое и новое. */}
              {item.diffs.length > 0 && (
                <Group gap={6} wrap="wrap" mt={4}>
                  {item.diffs.map((diff) => (
                    <Box
                      key={diff.key}
                      px={8}
                      py={3}
                      style={{
                        borderRadius: 6,
                        background: 'var(--mantine-color-gray-0)',
                        border: '1px solid var(--mantine-color-gray-2)',
                      }}
                    >
                      <Text component="span" size="xs" c="dimmed">
                        {FIELD_LABELS[diff.key] ?? diff.key}
                        {': '}
                      </Text>
                      <Text component="span" size="xs" td="line-through" c="dimmed">
                        {formatHistoryValue(diff.key, diff.from)}
                      </Text>
                      <Text component="span" size="xs" c="gray.5">
                        {' → '}
                      </Text>
                      <Text component="span" size="xs">
                        {formatHistoryValue(diff.key, diff.to)}
                      </Text>
                    </Box>
                  ))}
                </Group>
              )}

              <Text size="xs" c="dimmed" mt={2}>
                {dayjs(item.changedAt).format('DD.MM.YYYY HH:mm:ss')} ·{' '}
                <Text component="span" c="dark.6">
                  {item.author}
                </Text>
              </Text>
            </Box>
          </Group>
        );
      })}
    </Box>
  );
}
