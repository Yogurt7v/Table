import { Badge, Box, Checkbox, Group, Stack, Text } from '@mantine/core';
import { MAIL_TREE_INDENT } from '@/features/mail/mail-thread-builder';
import type { MailPrintLetter } from '@/features/mail/mail-thread-print';
import { MAIL_REGISTER_BADGE_LABELS, MAIL_REGISTER_COLORS } from '@/features/mail/mail-labels';

/** Пропсы дерева писем с флажками файлов. */
export interface MailThreadPrintLetterListProps {
  letters: readonly MailPrintLetter[];
  checked: ReadonlySet<string>;
  onToggle: (fileId: string) => void;
}

/**
 * Дерево писем с флажками вложений.
 * Рендерит письма по глубине: заголовок с типом и темой, под ним — файлы с
 * отметками либо пометка «Вложений нет».
 */
export function MailThreadPrintLetterList({
  letters,
  checked,
  onToggle,
}: MailThreadPrintLetterListProps) {
  return (
    <Stack gap="xs" pr={4}>
      {letters.map((letter) => (
        <Box key={letter.key} pl={letter.depth * MAIL_TREE_INDENT}>
          {/* Заголовок письма: тип и тема */}
          <Group gap={6} wrap="wrap">
            <Badge size="xs" variant="light" color={MAIL_REGISTER_COLORS[letter.type]}>
              {MAIL_REGISTER_BADGE_LABELS[letter.type]}
            </Badge>
            <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
              {letter.heading}
            </Text>
          </Group>

          {/* Вложения письма или пометка об их отсутствии */}
          {letter.files.length === 0 ? (
            <Text size="xs" c="dimmed" pl={MAIL_TREE_INDENT}>
              Вложений нет
            </Text>
          ) : (
            <Stack gap={4} pl={MAIL_TREE_INDENT}>
              {letter.files.map((file) => (
                <Checkbox
                  key={file.id}
                  size="xs"
                  checked={checked.has(file.id)}
                  onChange={() => onToggle(file.id)}
                  label={
                    <Text
                      size="xs"
                      style={{
                        overflowWrap: 'anywhere',
                        color: file.kind === 'other' ? 'var(--mantine-color-dimmed)' : undefined,
                      }}
                    >
                      {file.displayName}
                      {file.kind === 'other' && ' — печатается только название'}
                    </Text>
                  }
                />
              ))}
            </Stack>
          )}
        </Box>
      ))}
    </Stack>
  );
}
