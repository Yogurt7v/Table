import { Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

interface CreateButtonProps {
  canCreate: boolean;
  onCreate: () => void;
}

/** Кнопка создания документа (показана только при canCreate). */
export function CreateButton({ canCreate, onCreate }: CreateButtonProps) {
  if (!canCreate) return null;
  return (
    <Button leftSection={<IconPlus size={16} />} onClick={onCreate}>
      Добавить документ
    </Button>
  );
}
