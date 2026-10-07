import { Badge, Group, Text, UnstyledButton } from '@mantine/core';
import { formatMailDate } from './mail-date';
import {
  MAIL_EMPTY_CELL,
  MAIL_NUMBER_FIELD_LABELS,
  MAIL_REGISTER_BADGE_LABELS,
  MAIL_REGISTER_COLORS,
} from './mail-labels';
import type { MailCandidate } from './mail-parent';

/**
 * Строка письма-кандидата в списках выбора родителя.
 *
 * Один компонент на оба места — предложение под полем номера и ручной подбор
 * из всех писем организации, — потому что различаются они только тем, кому
 * предлагают, а не тем, что предлагают. Две почти одинаковые копии разъехались
 * бы при первом же добавлении колонки.
 *
 * Вся строка — кнопка: попадать пальцем в номер письма приходилось бы при
 * отладке номера, а выбор делается на десятках строк подряд.
 */

interface MailCandidateRowProps {
  candidate: MailCandidate;
  onPick: () => void;
  /** Права на связь нет — строка остаётся видимой, но не нажимаемой. */
  disabled?: boolean;
  /** Подсказка почему: у полосы предложение есть, а кнопки может не быть. */
  title?: string;
}

export function MailCandidateRow({ candidate, onPick, disabled, title }: MailCandidateRowProps) {
  return (
    <UnstyledButton
      onClick={onPick}
      disabled={disabled}
      title={title}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '7px 8px',
        borderRadius: 'var(--mantine-radius-sm)',
        border: '1px solid var(--mantine-color-gray-3)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Group gap={6} wrap="wrap">
        <Badge size="xs" variant="light" color={MAIL_REGISTER_COLORS[candidate.type]}>
          {MAIL_REGISTER_BADGE_LABELS[candidate.type]}
        </Badge>
        <Text size="xs" c="dimmed" inline>
          {MAIL_NUMBER_FIELD_LABELS[candidate.type]}
        </Text>
        <Text size="sm" fw={600} inline>
          {candidate.number || MAIL_EMPTY_CELL}
        </Text>
        <Text size="xs" c="dimmed" inline>
          {` · ${candidate.counterparty || MAIL_EMPTY_CELL} · ${formatMailDate(candidate.dateKey)}`}
        </Text>
      </Group>
      <Text size="xs" lineClamp={2} mt={2}>
        {candidate.subject || MAIL_EMPTY_CELL}
      </Text>
    </UnstyledButton>
  );
}
