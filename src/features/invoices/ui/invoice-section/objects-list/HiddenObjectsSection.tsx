import type { ReactNode } from 'react';
import { Collapse, Group, Paper, Stack, Title } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { IAccountingObject } from '@/shared/types';

interface HiddenObjectsSectionProps {
  hiddenObjects: IAccountingObject[];
  opened: boolean;
  onToggle: () => void;
  renderObjectBlock: (obj: IAccountingObject) => ReactNode;
}

/** Сворачиваемая секция «Объекты без счетов» с блоками этих объектов внутри. */
export function HiddenObjectsSection({
  hiddenObjects,
  opened,
  onToggle,
  renderObjectBlock,
}: HiddenObjectsSectionProps) {
  if (hiddenObjects.length === 0) return null;

  return (
    <Paper
      withBorder
      p={0}
      style={{
        borderLeft: '3px dashed var(--mantine-color-gray-4)',
        boxShadow: 'var(--mantine-shadow-sm)',
      }}
    >
      <Group
        gap={4}
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          padding: 'var(--mantine-spacing-xs)',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          color: 'var(--mantine-color-dimmed)',
        }}
        role="button"
        aria-expanded={opened}
        aria-label={opened ? 'Свернуть объекты без счетов' : 'Развернуть объекты без счетов'}
      >
        {opened ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
        <Title order={5} c="dimmed">
          Объекты без счетов ({hiddenObjects.length})
        </Title>
      </Group>
      <Collapse in={opened}>
        <Stack gap="sm" p="sm">
          {hiddenObjects.map(renderObjectBlock)}
        </Stack>
      </Collapse>
    </Paper>
  );
}
