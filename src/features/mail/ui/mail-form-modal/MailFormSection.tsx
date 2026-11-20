import type { ReactNode } from 'react';
import { Box, Group, Stack, Text } from '@mantine/core';

/**
 * Подзаголовок группы полей. Тихая подпись с линейкой, а не заголовок: группы
 * нужны, чтобы глаз не перечитывал все поля подряд, но спорить с названием
 * окна им не место.
 */
export function MailFormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Group gap="xs" wrap="nowrap" align="center" mb="xs">
        <Text size="xs" fw={600} c="dimmed" style={{ flexShrink: 0 }}>
          {title}
        </Text>
        <Box style={{ flex: 1, height: 1, background: 'var(--mantine-color-default-border)' }} />
      </Group>
      <Stack gap="sm">{children}</Stack>
    </Box>
  );
}
