import { Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconLink, IconLinkOff, IconPointFilled } from '@tabler/icons-react';
import type { MailType } from '@/shared/types';
import { formatMailDate } from './mail-date';
import { MailCandidateRow } from './MailCandidateRow';
import {
  MAIL_EMPTY_CELL,
  MAIL_REGISTER_BADGE_LABELS,
  MAIL_REGISTER_TAB_LABELS,
} from './mail-labels';
import { PARENT_REGISTER_BY_TYPE } from './mail-parent';
import type { MailCandidate, ParentIntent, ParentSuggestion } from './mail-parent';

/**
 * Догадка по номеру контрагента — подсказка под полем, из которого она выросла.
 *
 * Номер контрагента — текст, а связь живёт в `mail_relations`. Поэтому здесь
 * ничего не связывается молча: совпадение по номеру показывается как догадка и
 * требует одного из явных ответов. Ручного выбора среди всех писем здесь нет —
 * им занимается поле «Ответ на» рядом, и второй вход в то же самое означал бы
 * два разных места, где живёт связь.
 *
 * Четыре состояния предложения, и ни одного молчаливого: нет номера — не
 * спрашиваем вовсе; нет совпадений — письмо остаётся началом цепочки; одно
 * совпадение — подтвердить одним нажатием; несколько — выбрать из всех, иначе
 * выбирать нельзя.
 */

interface MailParentHintProps {
  mailType: MailType;
  /** Введённый номер — уже с задержкой пересчёта, как его видит `suggestParent`. */
  counterpartyNumber: string;
  suggestion: ParentSuggestion;
  intent: ParentIntent;
  /** Родитель, записанный сейчас; им предложение подавляется, чтобы не спорить само с собой. */
  parent: MailCandidate | null;
  /** Без права на связь подсказка скрыта вместе с полем: невидимое действие — это отсутствие. */
  canLink: boolean;
  onConfirm: (candidate: MailCandidate) => void;
  onDecline: () => void;
}

export function MailParentHint({
  mailType,
  counterpartyNumber,
  suggestion,
  intent,
  parent,
  canLink,
  onConfirm,
  onDecline,
}: MailParentHintProps) {
  if (!canLink) return null;
  // Решение принято — догадка больше не вопрос, и поле «Ответ на» уже показывает ответ.
  if (intent.kind !== 'pending') return null;
  if (suggestion.kind === 'empty') return null;
  if (suggestion.kind === 'none') {
    return <NoMatchNote mailType={mailType} counterpartyNumber={counterpartyNumber} />;
  }
  if (suggestion.kind === 'single' && parent?.key === suggestion.parent.key) return null;

  return <ProposalNote suggestion={suggestion} onConfirm={onConfirm} onDecline={onDecline} />;
}

/**
 * Догадка по номеру и два ответа на неё. Ни один из них не срабатывает сам:
 * «Связать» назначает родителя, «Начать цепочку» убирает подсказку и оставляет
 * письмо в корне.
 *
 * При нескольких совпадениях кнопки «Связать» нет: назначать нечего, пока
 * человек не указал, какое из писем имеется в виду.
 */
function ProposalNote({
  suggestion,
  onConfirm,
  onDecline,
}: {
  suggestion: Exclude<ParentSuggestion, { kind: 'empty' | 'none' }>;
  onConfirm: (candidate: MailCandidate) => void;
  onDecline: () => void;
}) {
  const declineButton = (
    <Button
      size="compact-xs"
      variant="subtle"
      color="gray"
      leftSection={<IconLinkOff size={12} />}
      onClick={onDecline}
    >
      Начать цепочку
    </Button>
  );

  if (suggestion.kind === 'collision') {
    return (
      <Paper withBorder p="xs" radius="sm" role="note">
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            {`Номер встречается у ${suggestion.candidates.length} писем — выберите, на какое это ответ`}
          </Text>
          <Stack gap={4}>
            {suggestion.candidates.map((candidate) => (
              <MailCandidateRow
                key={candidate.key}
                candidate={candidate}
                onPick={() => onConfirm(candidate)}
              />
            ))}
          </Stack>
          <Group gap="xs" wrap="wrap">
            {declineButton}
          </Group>
        </Stack>
      </Paper>
    );
  }

  const parent = suggestion.parent;
  return (
    <Paper withBorder p="xs" radius="sm" role="note">
      <Stack gap="xs">
        <Group gap={6} wrap="nowrap" align="flex-start">
          <IconPointFilled size={12} style={{ marginTop: 6, flexShrink: 0 }} />
          <Text size="sm" style={{ minWidth: 0 }}>
            Возможно, это ответ на{' '}
            <Text component="span" fw={600}>
              {MAIL_REGISTER_BADGE_LABELS[parent.type]}
            </Text>
            {` № ${parent.number || MAIL_EMPTY_CELL} от ${formatMailDate(parent.dateKey)} · ${parent.counterparty || MAIL_EMPTY_CELL}`}
          </Text>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {parent.subject || MAIL_EMPTY_CELL}
        </Text>
        <Group gap="xs" wrap="wrap">
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<IconLink size={12} />}
            onClick={() => onConfirm(parent)}
          >
            Связать
          </Button>
          {declineButton}
        </Group>
      </Stack>
    </Paper>
  );
}

/**
 * Совпадений нет — вопроса нет, поэтому и рамки нет: письмо остаётся началом
 * цепочки, а ответить можно в поле «Ответ на» строкой ниже.
 */
function NoMatchNote({
  mailType,
  counterpartyNumber,
}: {
  mailType: MailType;
  counterpartyNumber: string;
}) {
  const parentRegister = PARENT_REGISTER_BY_TYPE[mailType];
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <IconPointFilled size={12} style={{ marginTop: 5, flexShrink: 0 }} />
      <Box style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed">
          {`Ни одного письма с номером «${counterpartyNumber.trim()}» среди ${MAIL_REGISTER_TAB_LABELS[parentRegister].toLowerCase()} — это начало новой цепочки`}
        </Text>
      </Box>
    </Group>
  );
}
