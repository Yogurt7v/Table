import { Button } from '@mantine/core';
import { IconChevronsDown, IconChevronsUp } from '@tabler/icons-react';

interface CollapseToggleProps {
  collapsedAll: boolean;
  onToggleCollapseAll: () => void;
}

/** Кнопка «Свернуть / Развернуть» все группы. */
export function CollapseToggle({ collapsedAll, onToggleCollapseAll }: CollapseToggleProps) {
  return (
    <Button
      size="compact-md"
      variant="light"
      color="gray"
      flex="1"
      rightSection={collapsedAll ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
      onClick={onToggleCollapseAll}
      leftSection={collapsedAll ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
    >
      {collapsedAll ? 'Развернуть' : 'Свернуть'}
    </Button>
  );
}
