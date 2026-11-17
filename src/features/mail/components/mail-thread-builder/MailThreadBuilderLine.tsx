import { Box } from '@mantine/core';
import type { MailType } from '@/shared/types';
import {
  mailGapDropId,
  type ThreadDirection,
  type ThreadLineLayout,
  type ThreadOverState,
} from '@/features/mail/mail-thread-builder';
import { MailThreadGap } from '@/features/mail/MailThreadNode';
import {
  MAIL_DROP_HINT_BEFORE,
  MAIL_DROP_HINT_HEAD,
  MAIL_DROP_HINT_TAIL,
} from '@/features/mail/mail-thread-labels';
import { MailThreadBuilderLineRowSimple } from './MailThreadBuilderLineRowSimple';

/** Пропсы линии писем конструктора. */
export interface MailThreadBuilderLineProps {
  layout: ThreadLineLayout;
  wide: boolean;
  draggedKey: any;
  overId: string | null;
  directions: Map<string, ThreadDirection>;
  cyclicKeys: Set<string> | undefined;
  onGoToRegister?: (mailId: string, mailType: MailType, dateKey: string) => void;
}

/**
 * Линия писем конструктора: промежутки-цели и сами письма.
 * Рендерит прокручиваемую область с зонами сброса до, между и после писем.
 */
export function MailThreadBuilderLine({
  layout,
  wide,
  draggedKey,
  overId,
  directions,
  cyclicKeys,
  onGoToRegister,
}: MailThreadBuilderLineProps) {
  const stacked = !wide;
  const droppable = !!draggedKey;

  return (
    <Box
      data-mail-line=""
      data-mail-over={overId ?? ''}
      style={{
        maxHeight: 'min(62vh, 34rem)',
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Промежуток перед первым письмом */}
      <MailThreadGap
        zoneId={mailGapDropId({ kind: 'head' })}
        hint={MAIL_DROP_HINT_HEAD}
        droppable={droppable}
        overState={'none'}
        stacked={stacked}
      />

      {/* Письма линии с промежутками между ними */}
      {layout.nodes.map((node) => (
        <div key={node.key}>
          <MailThreadGap
            zoneId={mailGapDropId({ kind: 'before', before: node.key })}
            hint={MAIL_DROP_HINT_BEFORE}
            droppable={droppable}
            overState={'none'}
            stacked={stacked}
          />
          <MailThreadBuilderLineRowSimple
            key={node.key}
            index={node.index}
            type={node.type}
            id={node.id}
            date={node.letter?.date || ''}
            number={node.letter?.number}
            subject={node.letter?.subject}
            direction={directions.get(node.key) ?? 'down'}
            isCyclic={cyclicKeys?.has(node.key) ?? false}
            isDragging={draggedKey === node.key}
            onClick={() => onGoToRegister?.(node.id, node.type as MailType, '')}
          />
        </div>
      ))}

      {/* Промежуток после последнего письма */}
      <MailThreadGap
        zoneId={mailGapDropId({ kind: 'tail' })}
        hint={MAIL_DROP_HINT_TAIL}
        droppable={droppable}
        overState={'none'}
        stacked={stacked}
      />
    </Box>
  );
}