import type { ReactNode } from 'react';
import { Box, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import {
  IconLink,
  IconLinkOff,
  IconPencil,
  IconPlus,
  IconRestore,
  IconTrash,
} from '@tabler/icons-react';
import { useIncomingMailHistory, useOutgoingMailHistory } from '@/shared/hooks/useMail';
import type { MailHistoryType, MailType } from '@/shared/types';
import { formatMailTimestampSeconds } from './mail-date';
import { buildMailHistoryEntries, formatDiffValue } from './mail-history';
import { MAIL_HISTORY_FIELD_LABELS, MAIL_HISTORY_TYPE_LABELS } from './mail-labels';

const ACTION_ICONS: Record<MailHistoryType, ReactNode> = {
  created: <IconPlus size={14} />,
  updated: <IconPencil size={14} />,
  deleted: <IconTrash size={14} />,
  restored: <IconRestore size={14} />,
  linked: <IconLink size={14} />,
  unlinked: <IconLinkOff size={14} />,
};

interface MailHistoryModalProps {
  mailId: string | null;
  mailType: MailType;
  mailLabel: string;
  /** Снапшот `created_by_name` письма — автор создания (из строки таблицы). */
  createdByName?: string;
  /** Дата создания письма (`created`). */
  createdAt?: string;
  opened: boolean;
  onClose: () => void;
}

/**
 * История одного письма. Оба хука реестра вызваны безусловно, а активен
 * ровно один — иначе переключение типа письма внутри модалки нарушало бы
 * порядок хуков.
 */
export function MailHistoryModal({
  mailId,
  mailType,
  mailLabel,
  createdByName,
  createdAt,
  opened,
  onClose,
}: MailHistoryModalProps) {
  const id = opened && mailId ? mailId : '';
  const incoming = useIncomingMailHistory(mailType === 'incoming' ? id : '');
  const outgoing = useOutgoingMailHistory(mailType === 'outgoing' ? id : '');
  const query = mailType === 'incoming' ? incoming : outgoing;

  let entries = buildMailHistoryEntries(query.data ?? []);

  // Запись о создании письма всегда занимает ПОСЛЕДНЮЮ позицию в ленте
  // (история читается сверху вниз: старые события сверху, новые снизу).
  // Если в истории нет реального типа `created`, синтетически добавляем
  // запись из данных строки таблицы.
  const hasCreatedEntry = entries.some((entry) => entry.type === 'created');
  if (!hasCreatedEntry) {
    const creationTime = createdAt || entries[0]?.changedAt || new Date().toISOString();
    entries = [
      ...entries,
      {
        entryId: `created-${mailId ?? 'unknown'}`,
        changedAt: creationTime,
        author: createdByName || '—',
        type: 'created' as MailHistoryType,
        previousData: {},
        diffs: [],
      },
    ];
  } else {
    // Существующая запись о создании — переносим её в конец списка.
    const creationIdx = entries.findIndex((entry) => entry.type === 'created');
    if (creationIdx !== -1 && creationIdx !== entries.length - 1) {
      const [creation] = entries.splice(creationIdx, 1);
      entries.push(creation!);
    }
  }

  const hasDiff = entries.some((entry) => entry.diffs.length > 0);

  return (
    <Modal opened={opened} onClose={onClose} title={`История: ${mailLabel}`} size="lg">
      {query.isLoading && <Loader size="sm" />}

      {!query.isLoading && query.isError && (
        <Text c="red" size="sm">
          Не удалось загрузить историю письма
        </Text>
      )}

      {!query.isLoading && !query.isError && entries.length === 0 && (
        <Text c="dimmed">Изменений пока нет</Text>
      )}

      {!query.isLoading && !query.isError && entries.length > 0 && (
        <>
          {hasDiff && (
            <Text size="xs" c="dimmed" mb="sm">
              Старые значения зачёркнуты
            </Text>
          )}
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
                      {ACTION_ICONS[item.type]}
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
                    <Text size="sm" c="dark.5">
                      {MAIL_HISTORY_TYPE_LABELS[item.type]}
                    </Text>

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
                              {MAIL_HISTORY_FIELD_LABELS[diff.key] ?? diff.key}
                              {': '}
                            </Text>
                            <Text component="span" size="xs" td="line-through" c="dimmed">
                              {formatDiffValue(diff.from)}
                            </Text>
                            <Text component="span" size="xs" c="gray.5">
                              {' → '}
                            </Text>
                            <Text component="span" size="xs">
                              {formatDiffValue(diff.to)}
                            </Text>
                          </Box>
                        ))}
                      </Group>
                    )}

                    {typeof item.previousData['deleted_by_name'] === 'string' &&
                      item.previousData['deleted_by_name'] !== '' && (
                        <Text size="xs" c="dimmed" mt={2}>
                          Удалён: {item.previousData['deleted_by_name']}
                        </Text>
                      )}

                    <Text size="xs" c="dimmed" mt={2}>
                      {formatMailTimestampSeconds(item.changedAt)} · {item.author}
                    </Text>
                  </Box>
                </Group>
              );
            })}
          </Box>
        </>
      )}
    </Modal>
  );
}
