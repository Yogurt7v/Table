import { Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconLink, IconLinkOff, IconListSearch, IconPointFilled } from '@tabler/icons-react';
import type { MailType } from '@/shared/types';
import { formatMailDate } from './mail-date';
import { MailCandidateRow } from './MailCandidateRow';
import { MailLinkedParentCard } from './MailLinkedParentCard';
import {
  MAIL_EMPTY_CELL,
  MAIL_REGISTER_BADGE_LABELS,
  MAIL_REGISTER_TAB_LABELS,
} from './mail-labels';
import { PARENT_REGISTER_BY_TYPE } from './mail-parent';
import type { MailCandidate, ParentIntent, ParentSuggestion } from './mail-parent';

/**
 * Полоса под полем номера контрагента: предложение, а не решение.
 *
 * Номер контрагента — текст, а связь живёт в `mail_relations`. Полоса поэтому
 * ничего не связывает сама: совпадение по номеру показывается как догадка («Возможно,
 * это ответ на …») и требует одного из трёх явных ответов. Пока ответа нет,
 * видно и предложение, и текущую связь — и они не выглядят одинаково, чтобы
 * неподтверждённая догадка не читалась как уже сделанная.
 *
 * Четыре состояния предложения и ни одного молчаливого: нет номера — не
 * спрашиваем вовсе; нет совпадений — письмо остаётся началом цепочки; одно
 * совпадение — подтвердить одним нажатием; несколько — выбрать из всех, иначе
 * выбирать нельзя.
 */

interface MailParentStripProps {
  mailType: MailType;
  counterpartyNumber: string;
  suggestion: ParentSuggestion;
  /** Ответ человека. `pending` — предложение ещё не рассматривалось. */
  intent: ParentIntent;
  /** С кем письмо связано сейчас, — как видит форма, вместе с её правками. */
  parent: MailCandidate | null;
  canLink: boolean;
  onConfirm: (parent: MailCandidate) => void;
  onPickManually: () => void;
  onDecline: () => void;
  onOpenThread: (mailType: MailType, mailId: string) => void;
}

export function MailParentStrip({
  mailType,
  counterpartyNumber,
  suggestion,
  intent,
  parent,
  canLink,
  onConfirm,
  onPickManually,
  onDecline,
  onOpenThread,
}: MailParentStripProps) {
  if (intent.kind === 'pending') {
    const linkedCard = parent ? (
      <MailLinkedParentCard
        parent={parent}
        canLink={canLink}
        onOpenThread={onOpenThread}
        onRemove={onDecline}
      />
    ) : null;

    if (suggestion.kind === 'empty') return linkedCard;
    if (suggestion.kind === 'none') {
      return (
        linkedCard ?? (
          <NoMatchNote
            mailType={mailType}
            counterpartyNumber={counterpartyNumber}
            canLink={canLink}
            onPickManually={onPickManually}
          />
        )
      );
    }
    if (suggestion.kind === 'single' && parent?.key === suggestion.parent.key) return null;

    return (
      <Stack gap="xs">
        <ProposalNote
          suggestion={suggestion}
          canLink={canLink}
          onConfirm={onConfirm}
          onPickManually={onPickManually}
          onDecline={onDecline}
        />
        {linkedCard}
      </Stack>
    );
  }

  if (parent) {
    return <MailLinkedParentCard parent={parent} canLink={canLink} onOpenThread={onOpenThread} />;
  }

  return (
    <Paper withBorder p="xs" radius="sm" role="note">
      <Group gap={6} wrap="nowrap" align="flex-start">
        <IconPointFilled size={12} style={{ marginTop: 6, flexShrink: 0 }} />
        <Text size="sm">Связь снята — письмо начало цепочки</Text>
      </Group>
    </Paper>
  );
}

interface ProposalNoteProps {
  suggestion: Exclude<ParentSuggestion, { kind: 'empty' | 'none' }>;
  canLink: boolean;
  onConfirm: (parent: MailCandidate) => void;
  onPickManually: () => void;
  onDecline: () => void;
}

/**
 * Догадка по номеру и три ответа на неё. Ни один из них не срабатывает сам:
 * «Связать» и «Другое письмо» назначают родителя, «Это начало цепочки» убирает
 * подсказку и оставляет письмо в корне.
 *
 * При нескольких совпадениях кнопки «Связать» нет: назначать нечего, пока
 * человек не указал, какое из писем имеется в виду.
 */
function ProposalNote({
  suggestion,
  canLink,
  onConfirm,
  onPickManually,
  onDecline,
}: ProposalNoteProps) {
  const declineButton = (
    <Button
      size="compact-xs"
      variant="subtle"
      color="gray"
      leftSection={<IconLinkOff size={12} />}
      onClick={onDecline}
    >
      Это начало цепочки
    </Button>
  );

  const manualButton = (
    <Button
      size="compact-xs"
      variant="subtle"
      color="gray"
      leftSection={<IconListSearch size={12} />}
      onClick={onPickManually}
      disabled={!canLink}
    >
      Другое письмо
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
                disabled={!canLink}
              />
            ))}
          </Stack>
          <Group gap="xs" wrap="wrap">
            {manualButton}
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
        <Text size="xs" c="dimmed" lineClamp={2}>
          {parent.subject || MAIL_EMPTY_CELL}
        </Text>
        <Group gap="xs" wrap="wrap">
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<IconLink size={12} />}
            onClick={() => onConfirm(parent)}
            disabled={!canLink}
          >
            Связать
          </Button>
          {manualButton}
          {declineButton}
        </Group>
      </Stack>
    </Paper>
  );
}

function NoMatchNote({
  mailType,
  counterpartyNumber,
  canLink,
  onPickManually,
}: {
  mailType: MailType;
  counterpartyNumber: string;
  canLink: boolean;
  onPickManually: () => void;
}) {
  const parentRegister = PARENT_REGISTER_BY_TYPE[mailType];
  return (
    <Paper withBorder p="xs" radius="sm" role="note">
      <Stack gap="xs">
        <Group gap={6} wrap="nowrap" align="flex-start">
          <IconPointFilled size={12} style={{ marginTop: 6, flexShrink: 0 }} />
          <Box style={{ minWidth: 0 }}>
            <Text size="sm" fw={600}>
              Начало новой цепочки
            </Text>
            <Text size="xs" c="dimmed">
              {`Ни одного письма с номером «${counterpartyNumber.trim()}» среди ${MAIL_REGISTER_TAB_LABELS[parentRegister].toLowerCase()}`}
            </Text>
          </Box>
        </Group>
        {canLink && (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconListSearch size={12} />}
            onClick={onPickManually}
            style={{ alignSelf: 'flex-start' }}
          >
            Указать письмо вручную
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
