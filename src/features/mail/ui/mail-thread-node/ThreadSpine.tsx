/** Вертикальная линия переписки с ответвлением и засечкой для узла. */

import { Box } from '@mantine/core';
import { MAIL_REGISTER_COLORS } from '@/features/mail/mail-labels';
import type { ThreadOverState } from '@/features/mail/mail-thread-builder';
import {
  SPINE_DROP,
  SPINE_HOVER,
  SPINE_IDLE,
  SPINE_REJECT,
  SPINE_WIDTH,
  TICK_SIZE,
} from './mail-thread-node-constants';
import { MAIL_TREE_INDENT } from '@/features/mail/mail-thread-builder';

/**
 * Ячейка линии: вертикальная черта, ответвление к письму и засечка по центру
 * строки. Все три детали — настоящие элементы, а не псевдоэлементы в `style`:
 * разметка строится без таблицы измерений, поэтому черта не отрывается от письма
 * ни при какой высоте строки, а засечка всегда попадает в середину. Длина
 * ответвления равна шагу вложенности — ровно тот отступ, что был у дерева.
 */
export function ThreadSpine({
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

  // Рендерит вертикальную ось, ответвление к письму (при depth > 0) и круглую засечку регистра.
  return (
    <Box style={{ position: 'relative', width: SPINE_WIDTH, flexShrink: 0 }}>
      {/* Вертикальная черта линии времени */}
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
      {/* Горизонтальное ответвление к письму на глубине > 0 */}
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
      {/* Засечка регистра по центру строки */}
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
