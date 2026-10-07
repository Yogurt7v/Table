import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconCheck, IconLink, IconLinkOff } from '@tabler/icons-react';
import type { MailType } from '@/shared/types';
import { formatMailDate } from './mail-date';
import { MAIL_EMPTY_CELL, MAIL_NUMBER_FIELD_LABELS } from './mail-labels';
import type { MailCandidate } from './mail-parent';

/**
 * Карточка сохранённой связи — единственное, что в переписке считается фактом.
 *
 * Живёт отдельно от полосы предложения намеренно: полоса спрашивает про
 * догадку по номеру, а эта карточка показывает `mail_relations`. Смешанные в
 * одном компоненте, они выглядели бы одинаково, и неподтверждённая догадка
 * читалась бы как сделанная связь.
 */

interface MailLinkedParentCardProps {
  parent: MailCandidate;
  canLink: boolean;
  onOpenThread: (mailType: MailType, mailId: string) => void;
  /** Снять связь прямо отсюда; `undefined` — кнопки нет (нет права). */
  onRemove?: () => void;
}

export function MailLinkedParentCard({
  parent,
  canLink,
  onOpenThread,
  onRemove,
}: MailLinkedParentCardProps) {
  return (
    <Paper
      withBorder
      p="xs"
      radius="sm"
      role="note"
      style={{ background: 'var(--mantine-color-teal-0)' }}
    >
      <Stack gap="xs">
        <Group gap={6} wrap="nowrap" align="flex-start">
          <IconCheck
            size={16}
            style={{ marginTop: 2, flexShrink: 0 }}
            color="var(--mantine-color-teal-7)"
          />
          <Text size="sm" style={{ minWidth: 0 }}>
            Связано с{' '}
            <Text component="span" fw={600}>
              {MAIL_NUMBER_FIELD_LABELS[parent.type]}
            </Text>
            {` № ${parent.number || MAIL_EMPTY_CELL} от ${formatMailDate(parent.dateKey)} · ${parent.counterparty || MAIL_EMPTY_CELL}`}
          </Text>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={2}>
          {parent.subject || MAIL_EMPTY_CELL}
        </Text>
        <Group gap="xs" wrap="wrap">
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<IconLink size={12} />}
            onClick={() => onOpenThread(parent.type, parent.id)}
          >
            Открыть переписку
          </Button>
          {onRemove && canLink && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<IconLinkOff size={12} />}
              onClick={onRemove}
            >
              Это начало цепочки
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
