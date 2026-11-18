import { Anchor, Badge, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { IconFile } from '@tabler/icons-react';
import type { DocumentSourceInfo } from '@/shared/types';

/** Пропсы блока «Исходный счёт». */
export interface DocumentCardModalSourceProps {
  source: DocumentSourceInfo | null;
  loading: boolean;
}

/**
 * Блок «Исходный счёт»: номер, контрагент, сумма и файлы счёта,
 * из которого был создан документ. Показывается только при наличии источника.
 */
export function DocumentCardModalSource({ source, loading }: DocumentCardModalSourceProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text fw={600} size="sm" c="dimmed" tt="uppercase" mb="sm">
        Исходный счёт
      </Text>
      {loading ? (
        <Loader size="sm" />
      ) : source ? (
        <Stack gap="xs">
          <Group justify="space-between" wrap="wrap">
            <Text size="sm" fw={500}>
              Счёт №{source.invoiceNo || '—'} · {source.counterparty}
            </Text>
            {source.deleted && (
              <Badge color="red" variant="light">
                Счёт удалён
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            {source.amount.toLocaleString('ru-RU')} ₽
          </Text>
          {source.files.length === 0 ? (
            <Text size="sm" c="dimmed">
              Файлов счёта нет
            </Text>
          ) : (
            source.files.map((file) => (
              <Anchor key={file.id} href={file.url} target="_blank" rel="noreferrer" size="sm">
                <Group gap={6} wrap="nowrap">
                  <IconFile size={14} />
                  <Text size="sm" truncate>
                    {file.name}
                  </Text>
                </Group>
              </Anchor>
            ))
          )}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Исходный счёт не найден
        </Text>
      )}
    </Paper>
  );
}
