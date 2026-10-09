import type { ReactNode } from 'react';
import { ActionIcon, Badge, Box, Group, Paper, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconGripVertical,
  IconMail,
  IconSearch,
} from '@tabler/icons-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { MailLetter } from './mail-thread';
import { MAIL_TREE_INDENT, mailNodeDropId } from './mail-thread-builder';
import type { ThreadLineNode, ThreadDirection, ThreadOverState } from './mail-thread-builder';
import { formatMailDate, toDateKey } from './mail-date';
import { MAIL_CHAIN_DIRECTION_LABELS } from './mail-thread-labels';
import { MAIL_EMPTY_CELL, MAIL_REGISTER_BADGE_LABELS, MAIL_REGISTER_COLORS } from './mail-labels';

/**
 * Письмо в линии переписки: дата и номер слева от линии, сама линия с засечкой
 * в середине строки, письмо справа — с отступом по глубине.
 *
 * Порядок колонок не случаен: время течёт вниз по левому краю, поэтому письма
 * сравниваются между собой, не читая их, а линия читается как непрерывная ось.
 * Засечка — единственный носитель регистра: синяя и оранжевая повторяют цвета
 * бейджей реестра, поэтому взгляд по вертикали читает чередование сторон.
 */

const DIRECTION_ICONS: Record<ThreadDirection, ReactNode> = {
  anchor: <IconMail size={13} />,
  up: <IconArrowUpRight size={13} />,
  down: <IconArrowDownRight size={13} />,
};

const MISSING_LETTER_LABEL = 'Письмо недоступно — связь ссылается на удалённое письмо';

/** Ширина колонки подписей и самой линии. Числа, а не `rem`: колонки узкие и постоянные. */
const GUTTER_WIDTH = 96;
const SPINE_WIDTH = 26;
const TICK_SIZE = 11;
const HANDLE_BOX = 32;

const SPINE_IDLE = 'var(--mantine-color-gray-4)';
const SPINE_HOVER = 'var(--mantine-color-blue-5)';
const SPINE_DROP = 'var(--mantine-color-blue-6)';
const SPINE_REJECT = 'var(--mantine-color-red-6)';

interface MailThreadNodeProps {
  node: ThreadLineNode;
  direction: ThreadDirection;
  isAnchor: boolean;
  isCyclic: boolean;
  /** Право двигать это письмо: без него перетаскивание не начинается вовсе. */
  canDrag: boolean;
  /** Зона сброса регистрируется только пока что-то тянут. */
  droppable: boolean;
  overState: ThreadOverState;
  /** Узкий экран: дата и номер встают над письмом, линия остаётся слева. */
  stacked: boolean;
  /** Вызывать при клике по иконке — переход к письму в реестре. */
  onGoToRegister?: (mailId: string, mailType: MailType, dateKey: string) => void;
}

/**
 * Строка линии. Три колонки: подписи слева, линия с засечкой, письмо справа с
 * отступом `MAIL_TREE_INDENT * depth` — тем же шагом, что был у дерева, поэтому
 * обе формы читаются как одна система.
 */
export function MailThreadNode({
  node,
  direction,
  isAnchor,
  isCyclic,
  canDrag,
  droppable,
  overState,
  stacked,
  onGoToRegister
}: MailThreadNodeProps) {
  const letter = node.letter;
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: node.key,
    disabled: !canDrag,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: mailNodeDropId(node.key),
    disabled: !droppable,
  });

  const columns = stacked
    ? `${SPINE_WIDTH}px minmax(0, 1fr)`
    : `${GUTTER_WIDTH}px ${SPINE_WIDTH}px minmax(0, 1fr)`;

  return (
    <Box ref={setDropRef} data-mail-node={node.key} style={{ minWidth: 0 }}>
      <Box style={{ display: 'grid', gridTemplateColumns: columns, alignItems: 'stretch' }}>
        {!stacked && (
          <Box py={8} pr={8} style={{ textAlign: 'right', minWidth: 0 }}>
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {letter ? formatMailDate(letter.date) : MAIL_EMPTY_CELL}
            </Text>
            <Text
              size="xs"
              fw={600}
              title={letter?.number || undefined}
              style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {letter?.number || MAIL_EMPTY_CELL}
            </Text>
          </Box>
        )}

        <ThreadSpine
          type={node.type}
          depth={node.depth}
          isAnchor={isAnchor}
          overState={overState}
        />

        <Box py={4} pl={node.depth * MAIL_TREE_INDENT} style={{ minWidth: 0 }}>
          <Paper
            ref={setDragRef}
            withBorder
            radius="sm"
            p={stacked ? 'xs' : 8}
            style={{
              background: isAnchor ? 'var(--mantine-color-blue-0)' : undefined,
              // Письмо едет за курсором transform'ом, а не отдельной копией:
              // строка в линии остаётся на месте и работает зоной сброса, а
              // зритель видит ровно ту карточку, которую тянет.
              position: 'relative',
              zIndex: isDragging ? 2 : undefined,
              transform: CSS.Transform.toString(transform),
              cursor: isDragging ? 'grabbing' : undefined,
              opacity: isDragging ? 0.6 : 1,
              // Подсветка цели — тенью внутрь, а не толщиной рамки: толщина сдвинула
              // бы строку на пиксель ровно в момент отпускания письма.
              boxShadow: isDragging
                ? 'var(--mantine-shadow-md)'
                : isAnchor
                  ? 'var(--mantine-shadow-sm), inset 0 0 0 2px transparent'
                  : overState === 'ok'
                    ? 'inset 0 0 0 2px var(--mantine-color-blue-6)'
                    : overState === 'bad'
                      ? 'inset 0 0 0 2px var(--mantine-color-red-6)'
                      : undefined,
              minWidth: 0,
            }}
          >
            <Group gap={8} wrap="nowrap" align="flex-start">
              {canDrag ? (
                <ActionIcon
                  {...attributes}
                  {...listeners}
                  variant="subtle"
                  color="gray"
                  aria-label={`Перетащить письмо: ${letterLabel(letter)}`}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab', width: 32, height: 32 }}
                >
                  <IconGripVertical size={18} />
                </ActionIcon>
              ) : (
                <Box w={HANDLE_BOX} />
              )}

              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6} wrap="wrap" style={{ rowGap: 2 }}>
                  <Group gap={4} wrap="nowrap">
                    {DIRECTION_ICONS[direction]}
                    <Text size="xs" c="dimmed">
                      {MAIL_CHAIN_DIRECTION_LABELS[direction]}
                    </Text>
                  </Group>
                  <Badge size="xs" variant="light" color={MAIL_REGISTER_COLORS[node.type]}>
                    {MAIL_REGISTER_BADGE_LABELS[node.type]}
                  </Badge>
                  {isCyclic && (
                    <Badge
                      size="xs"
                      variant="light"
                      color="yellow"
                      leftSection={<IconAlertTriangle size={11} />}
                    >
                      кольцо
                    </Badge>
                  )}
                  {stacked && (
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {letter
                        ? `${formatMailDate(letter.date)} · ${letter.number || MAIL_EMPTY_CELL}`
                        : MAIL_EMPTY_CELL}
                    </Text>
                  )}
                </Group>

                {letter ? (
                  <>
                    <Text size="sm" fw={600} mt={2} style={{ overflowWrap: 'anywhere' }}>
                      {letter.counterparty || MAIL_EMPTY_CELL}
                    </Text>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {letter.subject || MAIL_EMPTY_CELL}
                    </Text>
                  </>
                ) : (
                  <Text size="sm" c="dimmed" mt={2}>
                    {MISSING_LETTER_LABEL}
                  </Text>
                )}
              </Box>

              {letter && onGoToRegister && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size={28}
                  aria-label={`Перейти к письму в реестре: ${letterLabel(letter)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onGoToRegister(node.id, node.type, toDateKey(letter.date) ?? '');
                  }}
                  style={{ flexShrink: 0 }}
                >
                  <IconSearch size={16} />
                </ActionIcon>
              )}
            </Group>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Ячейка линии: вертикальная черта, ответвление к письму и засечка по центру
 * строки. Все три детали — настоящие элементы, а не псевдоэлементы в `style`:
 * разметка строится без таблицы измерений, поэтому черта не отрывается от письма
 * ни при какой высоте строки, а засечка всегда попадает в середину. Длина
 * ответвления равна шагу вложенности — ровно тот отступ, что был у дерева.
 */
function ThreadSpine({
  type,
  depth,
  isAnchor,
  overState,
}: {
  type: 'incoming' | 'outgoing';
  depth: number;
  isAnchor: boolean;
  overState: ThreadOverState;
}) {
  const lineColor =
    overState === 'ok'
      ? SPINE_DROP
      : overState === 'bad'
        ? SPINE_REJECT
        : isAnchor
          ? SPINE_HOVER
          : SPINE_IDLE;

  return (
    <Box style={{ position: 'relative', width: SPINE_WIDTH, flexShrink: 0 }}>
      <Box
        style={{
          position: 'absolute',
          left: SPINE_WIDTH / 2 - 1,
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: lineColor,
        }}
      />
      {depth > 0 && (
        <Box
          style={{
            position: 'absolute',
            left: SPINE_WIDTH / 2,
            top: '50%',
            width: SPINE_WIDTH / 2 + depth * MAIL_TREE_INDENT,
            height: 2,
            backgroundColor: lineColor,
          }}
        />
      )}
      <Box
        style={{
          position: 'absolute',
          left: SPINE_WIDTH / 2 - TICK_SIZE / 2,
          top: '50%',
          marginTop: -TICK_SIZE / 2,
          width: TICK_SIZE,
          height: TICK_SIZE,
          borderRadius: '50%',
          boxSizing: 'border-box',
          backgroundColor: isAnchor
            ? lineColor
            : `var(--mantine-color-${MAIL_REGISTER_COLORS[type]}-6)`,
          border: `2px solid ${isAnchor ? 'var(--mantine-color-blue-0)' : 'var(--mantine-body)'}`,
        }}
      />
    </Box>
  );
}

interface MailThreadGapProps {
  /** Идентификатор зоны: `gap:head`, `gap:tail` или `gap:before:<ключ>`. */
  zoneId: string;
  /** Подпись цели, видимая, пока зона под курсором. */
  hint: string;
  droppable: boolean;
  overState: ThreadOverState;
  /** Узкий экран: колонки подписей нет, поэтому линия сдвигается к краю. */
  stacked: boolean;
}

/**
 * Промежуток между письмами — вторая цель сброса рядом с самим письмом.
 * Полоса всегда на своём месте, просто без рамки: иначе зоны не существовало бы
 * между плотно стоящими строками, а именно там её и ищут. Линия сквозь промежуток
 * обязательна — без неё ось распадалась бы на отрезки и переставала читаться
 * как одна ось времени.
 */
export function MailThreadGap({ zoneId, hint, droppable, overState, stacked }: MailThreadGapProps) {
  const { setNodeRef } = useDroppable({ id: zoneId, disabled: !droppable });
  const spineLeft = (stacked ? 0 : GUTTER_WIDTH) + SPINE_WIDTH / 2 - 1;

  return (
    <Box ref={setNodeRef} data-mail-gap={zoneId} style={{ position: 'relative', height: 16 }}>
      <Box
        style={{
          position: 'absolute',
          left: spineLeft,
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: SPINE_IDLE,
        }}
      />
      <Box
        style={{
          position: 'absolute',
          inset: '3px 0',
          borderRadius: 4,
          border: '1px dashed',
          borderColor:
            overState === 'ok'
              ? 'var(--mantine-color-blue-5)'
              : overState === 'bad'
                ? 'var(--mantine-color-red-5)'
                : 'transparent',
          backgroundColor: overState === 'none' ? 'transparent' : 'var(--mantine-color-blue-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: overState === 'bad' ? 'not-allowed' : undefined,
        }}
      >
        {overState !== 'none' && (
          <Text size="xs" c="dimmed" style={{ padding: '0 6px' }}>
            {hint}
          </Text>
        )}
      </Box>
    </Box>
  );
}

/** Подпись письма для `aria-label` ручки: пустое письмо назвать нечем. */
function letterLabel(letter: MailLetter | undefined): string {
  if (!letter) return 'письмо без подписей';
  return letter.number || letter.subject || 'письмо без номера';
}
