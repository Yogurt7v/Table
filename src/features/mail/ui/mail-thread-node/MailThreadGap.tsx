/** Промежуток между письмами — зона сброса при перетаскивании в линии переписки. */

import { Box, Text } from '@mantine/core';
import { useDroppable } from '@dnd-kit/core';
import type { ThreadOverState } from '@/features/mail/model/mail-thread-builder';
import { GUTTER_WIDTH, SPINE_IDLE, SPINE_WIDTH } from './mail-thread-node-constants';

interface MailThreadGapProps {
  /** Идентификатор зоны: `gap:head`, `gap:tail` или `gap:before:<ключ>`. */
  zoneId: string;
  /** Подпись цели, видимая, пока зона под курсором. */
  hint: string;
  /** Регистрировать ли зону как цель сброса (активно при перетаскивании). */
  droppable: boolean;
  /** Состояние подсветки зоны: спокойная, цель принятия или цель отказа. */
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

  // Рендерит сквозную линию оси и подсвечиваемую полосу-подсказку зоны сброса.
  return (
    <Box ref={setNodeRef} data-mail-gap={zoneId} style={{ position: 'relative', height: 16 }}>
      {/* Сквозная вертикальная линия оси времени */}
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
      {/* Подсвечиваемая зона сброса с подсказкой */}
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
