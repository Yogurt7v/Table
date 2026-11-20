import { Box } from '@mantine/core';
import type { MailType } from '@/shared/types';
import type { MailNodeKey } from '@/features/mail/mail-thread';
import {
  mailGapDropId,
  type ThreadDirection,
  type ThreadLineLayout,
  type ThreadOverState,
} from '@/features/mail/mail-thread-builder';
import { MailThreadGap, MailThreadNode } from '@/features/mail/MailThreadNode';
import {
  MAIL_DROP_HINT_BEFORE,
  MAIL_DROP_HINT_HEAD,
  MAIL_DROP_HINT_TAIL,
} from '@/features/mail/mail-thread-labels';

/** Пропсы линии писем конструктора. */
export interface MailThreadBuilderLineProps {
  layout: ThreadLineLayout;
  anchorKey: MailNodeKey;
  wide: boolean;
  draggedKey: MailNodeKey | null;
  overId: string | null;
  directions: Map<MailNodeKey, ThreadDirection>;
  cyclicKeys: ReadonlySet<MailNodeKey> | undefined;
  canDrag: (type: MailType) => boolean;
  nodeOverState: (key: MailNodeKey) => ThreadOverState;
  gapOverState: (zoneId: string) => ThreadOverState;
  onGoToRegister?: (mailId: string, mailType: MailType, dateKey: string) => void;
}

/**
 * Линия писем конструктора: промежутки-цели и сами письма.
 * Рендерит прокручиваемую область с зонами сброса до, между и после писем.
 */
export function MailThreadBuilderLine({
  layout,
  anchorKey,
  wide,
  draggedKey,
  overId,
  directions,
  cyclicKeys,
  canDrag,
  nodeOverState,
  gapOverState,
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
        overState={gapOverState(mailGapDropId({ kind: 'head' }))}
        stacked={stacked}
      />

      {/* Письма линии с промежутками между ними */}
      {layout.nodes.map((node) => (
        <div key={node.key}>
          <MailThreadGap
            zoneId={mailGapDropId({ kind: 'before', before: node.key })}
            hint={MAIL_DROP_HINT_BEFORE}
            droppable={droppable}
            overState={gapOverState(mailGapDropId({ kind: 'before', before: node.key }))}
            stacked={stacked}
          />
          <MailThreadNode
            node={node}
            direction={directions.get(node.key) ?? 'down'}
            isAnchor={node.key === anchorKey}
            isCyclic={cyclicKeys?.has(node.key) ?? false}
            canDrag={canDrag(node.type)}
            droppable={droppable}
            overState={nodeOverState(node.key)}
            stacked={stacked}
            onGoToRegister={onGoToRegister}
          />
        </div>
      ))}

      {/* Промежуток после последнего письма */}
      <MailThreadGap
        zoneId={mailGapDropId({ kind: 'tail' })}
        hint={MAIL_DROP_HINT_TAIL}
        droppable={droppable}
        overState={gapOverState(mailGapDropId({ kind: 'tail' }))}
        stacked={stacked}
      />
    </Box>
  );
}
