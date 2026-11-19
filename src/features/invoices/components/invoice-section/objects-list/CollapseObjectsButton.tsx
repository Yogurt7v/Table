import { Button } from '@mantine/core';
import { IconChevronsDown, IconChevronsUp } from '@tabler/icons-react';

interface CollapseObjectsButtonProps {
  show: boolean;
  allCollapsed: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

/** Кнопка «Свернуть/Развернуть» все группы объектов (если есть что сворачивать). */
export function CollapseObjectsButton({
  show,
  allCollapsed,
  onExpandAll,
  onCollapseAll,
}: CollapseObjectsButtonProps) {
  if (!show) return null;

  return (
    <Button
      size="compact-sm"
      variant="light"
      color="gray"
      flex="1"
      rightSection={allCollapsed ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
      onClick={allCollapsed ? onExpandAll : onCollapseAll}
      leftSection={allCollapsed ? <IconChevronsDown size={16} /> : <IconChevronsUp size={16} />}
    >
      {allCollapsed ? 'Развернуть' : 'Свернуть'}
    </Button>
  );
}
