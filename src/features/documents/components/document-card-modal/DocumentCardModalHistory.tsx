import { Center, Group, Loader, Paper, ScrollArea, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { IDocumentHistory } from '@/shared/types';
import { HISTORY_LABELS } from './document-card-modal-constants';
import { historyDetails } from './document-card-modal-utils';

/** Пропсы вкладки «История». */
export interface DocumentCardModalHistoryProps {
  history: IDocumentHistory[];
  loading: boolean;
}

/**
 * Вкладка «История»: лента изменений документа с автором, временем
 * и деталями изменённых полей.
 */
export function DocumentCardModalHistory({ history, loading }: DocumentCardModalHistoryProps) {
  if (loading) {
    return <Loader size="sm" />;
  }

  if (history.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="xs">
          <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
            <IconHistory size={24} />
          </ThemeIcon>
          <Text c="dimmed" size="sm">
            История пуста
          </Text>
        </Stack>
      </Center>
    );
  }

  // Лента событий: каждая запись — заголовок события, автор, время и детали полей
  return (
    <ScrollArea.Autosize mah={520}>
      <Stack gap="xs">
        {history.map((record) => {
          const details = historyDetails(record.previous_data, record.type);
          return (
            <Paper key={record.id} withBorder p="sm" radius="md">
              <Group justify="space-between" mb={4} align="flex-start" wrap="nowrap">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500}>
                    {HISTORY_LABELS[record.type] || record.type || 'Изменение'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {record.author_name || 'Система'}
                  </Text>
                </Stack>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {record.changed_at ? dayjs(record.changed_at).format('DD.MM.YYYY HH:mm') : ''}
                </Text>
              </Group>
              {details && (
                <ScrollArea mt={6} mah={160}>
                  <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap' }}>
                    {details}
                  </Text>
                </ScrollArea>
              )}
            </Paper>
          );
        })}
      </Stack>
    </ScrollArea.Autosize>
  );
}
