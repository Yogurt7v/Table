import type { ReactNode } from 'react';
import { ActionIcon, Badge, Box, Group, Paper, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowBarToDown,
  IconArrowDownRight,
  IconArrowUpRight,
  IconGripVertical,
  IconMail,
  IconSearch,
} from '@tabler/icons-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { MailType } from '@/shared/types';
import { MAIL_TREE_INDENT, mailNodeDropId } from '@/features/mail/model/mail-thread-builder';
import type {
  ThreadLineNode,
  ThreadDirection,
  ThreadOverState,
} from '@/features/mail/model/mail-thread-builder';
import { formatMailDate, toDateKey } from '@/features/mail/model/mail-date';
import { mailChainDirectionLabel } from '@/features/mail/model/mail-thread-labels';
import {
  MAIL_EMPTY_CELL,
  MAIL_REGISTER_BADGE_LABELS,
  MAIL_REGISTER_COLORS,
} from '@/features/mail/model/mail-labels';
import {
  GUTTER_WIDTH,
  HANDLE_BOX,
  MISSING_LETTER_LABEL,
  SPINE_WIDTH,
} from '../mail-thread-node/mail-thread-node-constants';
import { letterLabel } from '../mail-thread-node/mail-thread-node-utils';
import { ThreadSpine } from '../mail-thread-node/ThreadSpine';

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

/**
 * Иконка начала цепочки. Стрелка вверх обещала бы письмо выше, которого нет:
 * здесь линия, наоборот, уходит вниз, и этот изгиб читается честно. Размер и
 * вес те же, что у соседних стрелок, поэтому шапка не «прыгает».
 */
const CHAIN_ROOT_ICON: ReactNode = <IconArrowBarToDown size={13} />;

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
 * Строка линии переписки. Три колонки: подписи слева, линия с засечкой, письмо справа
 * с отступом `MAIL_TREE_INDENT * depth` — тем же шагом, что был у дерева.
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
  onGoToRegister,
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

  /**
   * Начало цепочки — по родителю, а не по номеру строки: цепочек в линии может
   * быть несколько, и второе начало стоит в середине списка, где «первое
   * письмо» уже неверно. Направление входит в условие обязательно — письмо,
   * снятое с переписки, рисуется последним корнем, но в граф не входит и
   * направления не имеет, так что шапка у него остаётся прежней.
   */
  const startsChain = direction === 'up' && node.parentKey === null;

  // Рендерит строку линии: колонку подписей (дата/номер), вертикальную линию и карточку письма.
  return (
    <Box ref={setDropRef} data-mail-node={node.key} style={{ minWidth: 0 }}>
      <Box style={{ display: 'grid', gridTemplateColumns: columns, alignItems: 'stretch' }}>
        {/* Колонка подписей слева: дата и номер (скрывается на узких экранах) */}
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

        {/* Вертикальная линия с засечкой и ответвлением по глубине */}
        <ThreadSpine
          type={node.type}
          depth={node.depth}
          isAnchor={isAnchor}
          overState={overState}
        />

        {/* Карточка письма с отступом по глубине */}
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
              {/* Ручка перетаскивания или заглушка для выравнивания */}
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

              {/* Содержимое письма: шапка, метки, контрагент и тема */}
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6} wrap="wrap" style={{ rowGap: 2 }}>
                  <Group gap={4} wrap="nowrap">
                    {startsChain ? CHAIN_ROOT_ICON : DIRECTION_ICONS[direction]}
                    <Text size="xs" c="dimmed">
                      {mailChainDirectionLabel(direction, startsChain)}
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
                  {/* Дата и номер в шапке карточки на узких экранах */}
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

              {/* Кнопка перехода к письму в реестре */}
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

// Реэкспорт для потребителей, импортирующих компоненты с прежнего пути модуля.
export { MailThreadGap } from '../mail-thread-node/MailThreadGap';
