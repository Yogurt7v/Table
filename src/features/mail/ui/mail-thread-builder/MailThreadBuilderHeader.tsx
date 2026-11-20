import { Button, Group, Text } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';

/** Пропсы заголовка конструктора. */
export interface MailThreadBuilderHeaderProps {
  title: string;
  printFileCount: number;
  onPrint: () => void;
}

/**
 * Заголовок конструктора переписки.
 * Рендерит тему письма и кнопку печати вложений — последняя появляется только
 * когда печатать действительно есть что.
 */
export function MailThreadBuilderHeader({
  title,
  printFileCount,
  onPrint,
}: MailThreadBuilderHeaderProps) {
  return (
    <Group gap="sm" justify="space-between" wrap="wrap">
      {/* Тема переписки */}
      <Text size="md" fw={600} style={{ overflowWrap: 'anywhere' }}>
        {title}
      </Text>

      {/* Печать вложений: кнопка есть только при непустом выборе */}
      {printFileCount > 0 && (
        <Button
          size="compact-xs"
          variant="light"
          leftSection={<IconPrinter size={14} />}
          onClick={onPrint}
          style={{ flexShrink: 0 }}
        >
          {`Печать вложений (${printFileCount})`}
        </Button>
      )}
    </Group>
  );
}
