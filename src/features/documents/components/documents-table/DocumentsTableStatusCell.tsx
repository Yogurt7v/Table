import { Tooltip } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

/** Пропсы ячейки статуса документа. */
export interface DocumentsTableStatusCellProps {
  value: boolean;
  label: string;
}

/**
 * Ячейка статуса «предоставлен / подтверждён».
 * Рендерит галочку или крестик с тултипом, описывающим состояние.
 */
export function DocumentsTableStatusCell({ value, label }: DocumentsTableStatusCellProps) {
  return value ? (
    <Tooltip label={label}>
      <IconCheck size={24} color="var(--mantine-color-green-6)" aria-label={label} />
    </Tooltip>
  ) : (
    <Tooltip label={`Не ${label.toLowerCase()}`}>
      <IconX
        size={24}
        color="var(--mantine-color-red-5)"
        aria-label={`Не ${label.toLowerCase()}`}
      />
    </Tooltip>
  );
}
