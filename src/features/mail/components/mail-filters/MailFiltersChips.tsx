import { ActionIcon, Badge, Group } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { MailFilterChip } from '@/features/mail/useMailFilters';

interface MailFiltersChipsProps {
  chips: MailFilterChip[];
  onRemove: (chip: MailFilterChip) => void;
}

/**
 * Строка активных фильтров под панелью: плашка на каждую группу со сбросом
 * по крестику — тот же `Badge`, что и в реестре счетов.
 */
export function MailFiltersChips({ chips, onRemove }: MailFiltersChipsProps) {
  if (chips.length === 0) return null;

  return (
    <Group gap={6} wrap="wrap">
      {chips.map((chip) => (
        <Badge
          key={`${chip.group}:${chip.value}`}
          variant="light"
          color="blue"
          size="sm"
          styles={{ label: { display: 'flex', alignItems: 'center', gap: 4 } }}
          rightSection={
            <ActionIcon
              size="xs"
              variant="transparent"
              color="blue"
              aria-label={`Убрать фильтр ${chip.label}`}
              onClick={() => onRemove(chip)}
            >
              <IconX size={10} />
            </ActionIcon>
          }
        >
          {chip.label}
        </Badge>
      ))}
    </Group>
  );
}
