import { useMemo, useState } from 'react';
import { Loader, Modal, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { MailType } from '@/shared/types';
import { mailNodeKey } from './mail-thread';
import { hasAnyRelation } from './mail-thread-builder';
import { planLinkChange } from './mail-parent';
import { useMailThreadOrder } from './mail-thread-order';
import { useMailLinkChange } from './useMailLinkChange';
import { useOrgMailThread } from './useOrgMailThread';
import { useOrgMailFiles } from './useOrgMailFiles';
import { MailParentPicker } from './MailParentPicker';
import { MailThreadPrintModal } from './MailThreadPrintModal';
import { useMailThreadDrag } from './components/mail-thread-builder/useMailThreadDrag';
import { useMailThreadLayout } from './components/mail-thread-builder/useMailThreadLayout';
import { MailThreadBuilderHeader } from './components/mail-thread-builder/MailThreadBuilderHeader';
import { MailThreadBuilderIntro } from './components/mail-thread-builder/MailThreadBuilderIntro';
import { MailThreadBuilderNotes } from './components/mail-thread-builder/MailThreadBuilderNotes';
import type {
  DetachedLetter,
  MailThreadBuilderProps,
} from './components/mail-thread-builder/mail-thread-builder-types';
import {
  buildThreadPrintLetters,
  countPrintFiles,
  groupPrintFilesByLetter,
} from './mail-thread-print';
import { formatMailDate } from './mail-date';
import { MAIL_EMPTY_CELL, MAIL_TYPE_LABELS } from './mail-labels';
import type { MailPermissions } from './mail-field-access';

/** Границы `sm` из темы Mantine — тот же порог, по которому реестр меняет таблицу на карточки. */
const WIDE_QUERY = '(min-width: 48em)';

/** Право двигать письмо — право править его регистр, и никакой роли. */
function canEditType(permissions: MailPermissions, type: MailType): boolean {
  return type === 'incoming' ? permissions.canEditIncoming : permissions.canEditOutgoing;
}

/**
 * Конструктор переписки: одна вертикальная линия писем, у которой перетаскивание
 * меняет настоящие связи, а не картинку.
 *
 * Три цели сброса ровно три (см. `resolveDrop`): на письмо — ответ на него, в
 * промежуток — сосед на его уровне, над первым или под последним — начало
 * цепочки. Всё, что замкнуло бы цепочку, отсекается **во время** перетаскивания:
 * курсор становится `not-allowed`, зона краснеет, и письмо туда не падает.
 *
 * Сама цепочка записана в `mail_relations`, и её единственный источник истины —
 * связи, а не номера: номер контрагента в переписку ничего не решает. Поэтому
 * пересвязывание идёт через `useMailLinkChange`, который снимает прежнюю связь и
 * только потом создаёт новую, а на отказе возвращает снятую и говорит об этом
 * вслух. Порядок между соседями из связей не следует, поэтому он живёт в
 * настройке пользователя (`mail-thread-order.ts`).
 *
 * Глубина и циклы разбирает `mail-thread.ts` — тот же обход с тем же пределом
 * `THREAD_MAX_DEPTH`, поэтому конструктор и цепочка внутри формы обещают одно и
 * то же. Замыкание кольца не запрещено: связи в базе им не защищены, письмо с
 * кольцом — это факт, который надо показать и попросить проверить номера, а не
 * потерять переписку.
 *
 * Перетаскивание живёт в `useMailThreadDrag`, расчёт линии — в
 * `useMailThreadLayout`, сама линия — в `MailThreadBuilderLine`, печать
 * вложений — в `MailThreadPrintModal`.
 */
export function MailThreadBuilder({
  opened,
  onClose,
  orgId,
  rootMailId,
  rootMailType,
  permissions,
  onGoToRegister,
}: MailThreadBuilderProps) {
  const activeOrgId = opened ? orgId : '';
  const { letters, graph, cyclicKeys, candidates, parentEdges, isLoading, isError } =
    useOrgMailThread(activeOrgId);
  const { ranks, place } = useMailThreadOrder();
  const linkChange = useMailLinkChange(orgId);
  const { data: orgFiles } = useOrgMailFiles(activeOrgId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [detached, setDetached] = useState<DetachedLetter | null>(null);

  // Ширина решается один раз и в остальном коде не участвует: раскладка строки
  // двухколоночная или трёхколоночная, а не «переверстать при изменении».
  const wide = useMediaQuery(WIDE_QUERY, true, { getInitialValueInEffect: true }) !== false;

  const anchorKey = useMemo(
    () => mailNodeKey(rootMailType, rootMailId),
    [rootMailType, rootMailId],
  );
  const { layout, directions } = useMailThreadLayout({
    graph,
    letters,
    anchorKey,
    ranks,
    detached,
    rootMailType,
    rootMailId,
  });

  const drag = useMailThreadDrag({
    layout,
    anchorKey,
    candidates,
    parentEdges,
    linkChange,
    place,
    onDetached: setDetached,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const rootLetter = letters?.get(anchorKey);
  const title = rootLetter
    ? `Переписка: ${formatMailDate(rootLetter.date)} · ${rootLetter.number || MAIL_EMPTY_CELL}`
    : `Переписка: ${MAIL_TYPE_LABELS[rootMailType]}`;

  const hasCycle = layout ? layout.nodes.some((node) => cyclicKeys?.has(node.key)) : false;
  const canMoveRoot = canEditType(permissions, rootMailType);
  const canDrag = (type: MailType) => canEditType(permissions, type);

  /**
   * Сколько файлов печать сможет предложить — по тем же правилам, по которым
   * модалка их перечислит. При нуле кнопка не появляется: открывать окно, в
   * котором нечего выбирать, незачем.
   */
  const printFileCount = useMemo(
    () =>
      layout
        ? countPrintFiles(
            buildThreadPrintLetters(layout.nodes, groupPrintFilesByLetter(orgFiles ?? [])),
          )
        : 0,
    [layout, orgFiles],
  );
  /** Подсказка про перетаскивание обещана только тем, кто правом имеет. */
  const canDragSomething =
    layout?.nodes.some((node) => canEditType(permissions, node.type)) ?? false;
  const unbuilt = layout ? !hasAnyRelation(layout) : false;
  const hasDetached = !!detached && !!layout?.nodes.some((node) => node.key === detached.key);

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <MailThreadBuilderHeader
            title={title}
            printFileCount={printFileCount}
            onPrint={() => setPrintOpen(true)}
          />
        }
        size="xl"
      >
        {isLoading && <Loader size="sm" />}

        {!isLoading && isError && (
          <Text c="red" size="sm">
            Не удалось загрузить переписку
          </Text>
        )}

        {!isLoading && !isError && layout && (
          <Stack gap="sm">
            <MailThreadBuilderIntro
              canDragSomething={canDragSomething}
              unbuilt={unbuilt}
              canMoveRoot={canMoveRoot}
              onPickParent={() => setPickerOpen(true)}
            />

            {/* Линия писем с перетаскиванием */}
            <DndContext
              sensors={sensors}
              // Указатель важнее геометрии: зоны сброса полосы в 16px, и «ближайший
              // центр» выбирал бы не ту строку, на которую указана мышь.
              collisionDetection={(args) => {
                const inside = pointerWithin(args);
                return inside.length > 0 ? inside : rectIntersection(args);
              }}
              onDragStart={drag.handleDragStart}
              onDragOver={drag.handleDragOver}
              onDragEnd={() => {
                void drag.handleDragEnd();
              }}
              onDragCancel={drag.resetDrag}
            >
              <MailThreadBuilderLineRowSimple
                layout={layout}
                anchorKey={anchorKey}
                wide={wide}
                draggedKey={drag.draggedKey}
                overId={drag.overId}
                directions={directions}
                cyclicKeys={cyclicKeys}
                canDrag={canDrag}
                nodeOverState={drag.nodeOverState}
                gapOverState={drag.gapOverState}
                onGoToRegister={onGoToRegister}
              />
            </DndContext>

            <MailThreadBuilderNotes
              hasCycle={hasCycle}
              hasDetached={hasDetached}
              skipped={layout.skipped}
            />
          </Stack>
        )}
      </Modal>

      {/* Печать вложений переписки */}
      <MailThreadPrintModal
        key={printOpen ? 'open' : 'closed'}
        opened={printOpen}
        onClose={() => setPrintOpen(false)}
        orgId={orgId}
        nodes={layout?.nodes ?? []}
        wide={wide}
      />

      {/* Выбор письма, на которое отвечает открытое */}
      <MailParentPicker
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        candidates={candidates}
        selfKey={anchorKey}
        childLabel={rootLetter?.number || MAIL_TYPE_LABELS[rootMailType]}
        onSelect={(candidate) => {
          void linkChange.changeLink({
            child: { id: rootMailId, type: rootMailType },
            plan: planLinkChange([], candidate) ?? { drop: [], create: candidate },
          });
        }}
      />
    </>
  );
}
