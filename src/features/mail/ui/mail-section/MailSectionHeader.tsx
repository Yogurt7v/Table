import { ActionIcon, Box, Button, Group, Paper, Tooltip } from '@mantine/core';
import { IconMailPlus, IconPlus, IconSettings } from '@tabler/icons-react';
import { BreadcrumbsNav } from '@/shared/components/BreadcrumbsNav';
import { MailSearchInput } from '@/features/mail/ui/search/MailSearchInput';
import type { MailType } from '@/shared/types';

/** Пропсы шапки раздела: поиск, счётчики и действия. */
export interface MailSectionHeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
  resultTotal: number;
  allowedCreateTypes: MailType[];
  onOpenColumnSettings: () => void;
  onCreate: (type: MailType) => void;
}

/**
 * Верхняя панель раздела почты.
 * Рендерит хлебные крошки, кнопку настройки колонок, создание письма и строку поиска.
 */
export function MailSectionHeader({
  searchValue,
  onSearchChange,
  resultCount,
  resultTotal,
  allowedCreateTypes,
  onOpenColumnSettings,
  onCreate,
}: MailSectionHeaderProps) {
  return (
    <Paper withBorder p="md" style={{ boxShadow: 'var(--mantine-shadow-sm)' }}>
      {/* Заголовок раздела: навигация, настройки колонок и действие создания письма */}
      <Group justify="space-between" mb="sm" wrap="wrap" gap="xs">
        <Group gap={8} align="center" wrap="wrap">
          <BreadcrumbsNav />
          <Tooltip label="Настройка колонок">
            <ActionIcon
              size="md"
              variant="subtle"
              color="gray"
              aria-label="Настройка колонок"
              onClick={onOpenColumnSettings}
            >
              <IconSettings size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {allowedCreateTypes.length > 0 && (
          <Button
            leftSection={
              allowedCreateTypes.length === 1 ? <IconPlus size={16} /> : <IconMailPlus size={16} />
            }
            onClick={() => onCreate(allowedCreateTypes[0]!)}
          >
            Создать письмо
          </Button>
        )}
      </Group>

      {/* Поле поиска по переписке с подсчётом найденных результатов */}
      <Box mb="sm">
        <MailSearchInput
          value={searchValue}
          onChange={onSearchChange}
          scopeLabel="переписке"
          resultCount={resultCount}
          resultTotal={resultTotal}
        />
      </Box>
    </Paper>
  );
}
