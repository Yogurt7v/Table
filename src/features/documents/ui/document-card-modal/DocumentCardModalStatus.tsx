import { Box, Grid, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconCheck, IconCircleCheck } from '@tabler/icons-react';
import type { IDocument } from '@/shared/types';

/** Круг с крестиком внутри — нарисован вручную, без внешних библиотек иконок. */
function IconCircleCross({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </svg>
  );
}

/** Пропсы блока статусов документа. */
export interface DocumentCardModalStatusProps {
  document: IDocument;
  canToggleProvided: boolean;
  canToggleConfirmed: boolean;
  /** Идёт сохранение статуса — клики на карточки заблокированы. */
  statusPending: boolean;
  onToggle: (field: 'provided' | 'confirmed') => void;
}

/**
 * Проминентный блок статусов: кликабельные карточки «Предоставлен» и «Подтверждён»
 * с цветовой подсветкой и отметкой о выбранном файле подтверждения.
 */
export function DocumentCardModalStatus({
  document,
  canToggleProvided,
  canToggleConfirmed,
  statusPending,
  onToggle,
}: DocumentCardModalStatusProps) {
  // «Подтверждён» кликается только после «Предоставлен» — иначе подтверждать нечего
  const confirmedClickable = canToggleConfirmed && document.provided && !statusPending;
  const confirmedHint = !document.provided
    ? 'Сначала отметьте «Предоставлен»'
    : canToggleConfirmed
      ? 'Нажмите, чтобы изменить'
      : document.confirmed
        ? 'Документ подтверждён'
        : 'Документ ещё не подтверждён';

  return (
    <Box>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={8}>
        Статус документа
      </Text>
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Paper
            withBorder
            radius="md"
            p="md"
            onClick={canToggleProvided && !statusPending ? () => onToggle('provided') : undefined}
            style={{
              borderColor: document.provided
                ? 'var(--mantine-color-green-5)'
                : 'var(--mantine-color-orange-4)',
              backgroundColor: document.provided
                ? 'var(--mantine-color-green-0)'
                : 'var(--mantine-color-orange-0)',
              cursor: canToggleProvided && !statusPending ? 'pointer' : 'default',
            }}
          >
            <Group gap="md" wrap="nowrap" align="center">
              <ThemeIcon
                size={56}
                radius="xl"
                variant={document.provided ? 'filled' : 'light'}
                color={document.provided ? 'green' : 'orange'}
              >
                {document.provided ? <IconCircleCheck size={34} /> : <IconCircleCross size={34} />}
              </ThemeIcon>
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Предоставлен
                </Text>
                <Text size="xl" fw={700} c={document.provided ? 'green.9' : 'orange.9'}>
                  {document.provided ? 'Да' : 'Нет'}
                </Text>
                <Text size="xs" c="dimmed">
                  {canToggleProvided
                    ? 'Нажмите, чтобы изменить'
                    : document.provided
                      ? 'Документ предоставлен'
                      : 'Документ ещё не предоставлен'}
                </Text>
              </Stack>
            </Group>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Paper
            withBorder
            radius="md"
            p="md"
            onClick={confirmedClickable ? () => onToggle('confirmed') : undefined}
            style={{
              borderColor: document.confirmed
                ? 'var(--mantine-color-green-5)'
                : document.provided
                  ? 'var(--mantine-color-orange-4)'
                  : 'var(--mantine-color-gray-3)',
              backgroundColor: document.confirmed
                ? 'var(--mantine-color-green-0)'
                : document.provided
                  ? 'var(--mantine-color-orange-0)'
                  : 'var(--mantine-color-gray-0)',
              cursor: canToggleConfirmed
                ? document.provided
                  ? 'pointer'
                  : 'not-allowed'
                : 'default',
              opacity: !document.provided ? 0.65 : 1,
            }}
          >
            <Group gap="md" wrap="nowrap" align="center">
              <ThemeIcon
                size={56}
                radius="xl"
                variant={document.confirmed ? 'filled' : 'light'}
                color={document.confirmed ? 'green' : document.provided ? 'orange' : 'gray'}
              >
                {document.confirmed ? <IconCircleCheck size={34} /> : <IconCircleCross size={34} />}
              </ThemeIcon>
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Подтверждён
                </Text>
                <Text
                  size="xl"
                  fw={700}
                  c={document.confirmed ? 'green.9' : document.provided ? 'orange.9' : 'gray.6'}
                >
                  {document.confirmed ? 'Да' : 'Нет'}
                </Text>
                <Text size="xs" c="dimmed">
                  {confirmedHint}
                </Text>
              </Stack>
            </Group>
          </Paper>
        </Grid.Col>
      </Grid>
      {/* Файл подтверждения выбран — отдельная подсветка под карточками */}
      {document.confirmed_file_id && (
        <Group gap="xs" mt="sm">
          <ThemeIcon size="sm" variant="light" color="green" radius="xl">
            <IconCheck size={12} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            Файл подтверждения выбран
          </Text>
        </Group>
      )}
    </Box>
  );
}
