import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconLinkPlus, IconPrinter } from '@tabler/icons-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { MailType } from '@/shared/types';
import type { MailNodeKey } from './mail-thread';
import { buildMailThread, mailNodeKey, THREAD_MAX_DEPTH } from './mail-thread';
import {
  buildThreadLine,
  descendantKeys,
  hasAnyRelation,
  mailGapDropId,
  mailNodeDropId,
  parseDropZone,
  resolveDrop,
} from './mail-thread-builder';
import { useMailThreadOrder } from './mail-thread-order';
import { candidateByKey, parentEdgesOf, planLinkChange } from './mail-parent';
import { useMailLinkChange } from './useMailLinkChange';
import { useOrgMailThread } from './useOrgMailThread';
import { useOrgMailFiles } from './useOrgMailFiles';
import { MailParentPicker } from './MailParentPicker';
import { MailThreadGap, MailThreadNode } from './MailThreadNode';
import { MailThreadPrintModal } from './MailThreadPrintModal';
import {
  buildThreadPrintLetters,
  countPrintFiles,
  groupPrintFilesByLetter,
} from './mail-thread-print';
import {
  MAIL_CHAIN_CYCLE_NOTE,
  MAIL_CHAIN_TRUNCATION_NOTE,
  MAIL_CYCLE_NOTIFICATION,
  MAIL_DROP_HINT_BEFORE,
  MAIL_DETACHED_LETTER_NOTE,
  MAIL_DROP_HINT_HEAD,
  MAIL_DROP_HINT_TAIL,
  MAIL_THREAD_UNBUILT_TITLE,
} from './mail-thread-labels';
import type { MailOrderPlacement, ThreadDirection, ThreadOverState } from './mail-thread-builder';
import { formatMailDate } from './mail-date';
import { MAIL_EMPTY_CELL, MAIL_TYPE_LABELS } from './mail-labels';
import type { MailPermissions } from './mail-field-access';

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
 */

/** Границы `sm` из темы Mantine — тот же порог, по которому реестр меняет таблицу на карточки. */
const WIDE_QUERY = '(min-width: 48em)';

interface MailThreadBuilderProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  rootMailId: string;
  rootMailType: MailType;
  permissions: MailPermissions;
  onGoToRegister?: (mailId: string, mailType: MailType, dateKey: string) => void;
}

/** Письмо, чьи подписи пришли с сброса и которого в графе уже нет. */
type DetachedLetter = { readonly key: MailNodeKey; readonly type: MailType; readonly id: string };

/** Право двигать письмо — право править его регистр, и никакой роли. */
function canEditType(permissions: MailPermissions, type: MailType): boolean {
  return type === 'incoming' ? permissions.canEditIncoming : permissions.canEditOutgoing;
}

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

  const [draggedKey, setDraggedKey] = useState<MailNodeKey | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
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

  /**
   * Письмо, снятое с этой переписки последним сбросом, остаётся в линии.
   *
   * Сброс в начало или в конец делает письмо началом своей цепочки — связь с
   * открытым письмом при этом исчезает, и письмо ушло бы из окна целиком. Но
   * человек только что поставил его в линию и ждёт, что оно там есть, поэтому
   * оно дорисовывается последним корнем, пока связь не появится снова.
   */
  const layout = useMemo(() => {
    const base = graph
      ? buildThreadLine({ graph, letters, anchor: anchorKey, order: ranks })
      : null;
    if (!base || !detached || base.nodes.some((node) => node.key === detached.key)) return base;
    return {
      ...base,
      nodes: [
        ...base.nodes,
        {
          key: detached.key,
          type: detached.type,
          id: detached.id,
          depth: 0,
          parentKey: null,
          letter: letters?.get(detached.key),
          index: base.nodes.length,
        },
      ],
    };
  }, [graph, letters, anchorKey, ranks, detached]);

  /** Направление шага: предок, потомок или само открытое письмо. Тот же обход, что у дерева. */
  const directions = useMemo(() => {
    const map = new Map<MailNodeKey, ThreadDirection>();
    map.set(anchorKey, 'anchor');
    if (!graph) return map;
    const thread = buildMailThread(graph, { key: anchorKey, type: rootMailType, id: rootMailId });
    for (const node of thread.ancestors) map.set(node.key, 'up');
    for (const node of thread.descendants) map.set(node.key, 'down');
    return map;
  }, [graph, anchorKey, rootMailType, rootMailId]);

  const forbidden = useMemo(
    () => (layout && draggedKey ? descendantKeys(layout, draggedKey) : null),
    [layout, draggedKey],
  );

  const resolution = useMemo(() => {
    if (!layout || !draggedKey || !overId) return null;
    const zone = parseDropZone(overId);
    if (!zone) return null;
    return resolveDrop(layout, zone, draggedKey);
  }, [layout, draggedKey, overId]);

  /**
   * Курсор отвечает на допустимость цели, а не на сам факт перетаскивания:
   * недопустимая зона должна быть видна до отпускания, иначе «письмо пропало»
   * читается как потеря связи.
   */
  useEffect(() => {
    if (!draggedKey) return;
    document.body.style.cursor = resolution ? 'grabbing' : 'not-allowed';
    return () => {
      document.body.style.cursor = '';
    };
  }, [draggedKey, resolution]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const nodeOverState = (key: MailNodeKey): ThreadOverState => {
    if (!draggedKey || overId !== mailNodeDropId(key)) return 'none';
    return resolution ? 'ok' : 'bad';
  };

  const gapOverState = (id: string): ThreadOverState => {
    if (!draggedKey || overId !== id) return 'none';
    return resolution ? 'ok' : 'bad';
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedKey(event.active.id as MailNodeKey);
    setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? (event.over.id as string) : null);
  };

  const resetDrag = () => {
    setDraggedKey(null);
    setOverId(null);
  };

  const applyDrop = async (
    dragged: MailNodeKey,
    placement: MailOrderPlacement,
    parent: MailNodeKey | null,
  ) => {
    const node = layout?.nodes.find((candidate) => candidate.key === dragged);
    if (!node) return;

    const existing = parentEdgesOf(parentEdges, dragged);
    const next = candidateByKey(candidates, parent);
    const plan = planLinkChange(existing, next);

    if (plan) {
      try {
        await linkChange.changeLink({ child: { id: node.id, type: node.type }, plan });
      } catch {
        return;
      }
    }

    if (placement.kind !== 'keep') {
      place(dragged, parent, placement, layout?.children.get(parent) ?? []);
    }
    setDetached(
      parent === null && dragged !== anchorKey
        ? { key: dragged, type: node.type, id: node.id }
        : null,
    );
    if (parent !== null && forbidden?.has(parent)) {
      notifications.show({ color: 'yellow', message: MAIL_CYCLE_NOTIFICATION });
    }
  };

  const handleDragEnd = async () => {
    const dragged = draggedKey;
    const current = resolution;
    resetDrag();
    if (!dragged || !current) return;
    await applyDrop(dragged, current.placement, current.parentKey);
  };

  const rootLetter = letters?.get(anchorKey);
  const title = rootLetter
    ? `Переписка: ${formatMailDate(rootLetter.date)} · ${rootLetter.number || MAIL_EMPTY_CELL}`
    : `Переписка: ${MAIL_TYPE_LABELS[rootMailType]}`;

  const hasCycle = layout ? layout.nodes.some((node) => cyclicKeys?.has(node.key)) : false;
  const canMoveRoot = canEditType(permissions, rootMailType);

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

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="sm" justify="space-between" wrap="wrap">
            <Text size="md" fw={600} style={{ overflowWrap: 'anywhere' }}>
              {title}
            </Text>
            {printFileCount > 0 && (
              <Button
                size="compact-xs"
                variant="light"
                leftSection={<IconPrinter size={14} />}
                onClick={() => setPrintOpen(true)}
                style={{ flexShrink: 0 }}
              >
                {`Печать вложений (${printFileCount})`}
              </Button>
            )}
          </Group>
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
            {canDragSomething && (
              <Text size="xs" c="dimmed">
                Перетащите письмо на другое — оно станет ответом на него; в промежуток между
                письмами — встанет рядом с соседом; над первым или под последним — начнёт цепочку.
              </Text>
            )}

            {!hasAnyRelation(layout) && (
              <Alert
                color="blue"
                variant="light"
                icon={<IconLinkPlus size={16} />}
                title={MAIL_THREAD_UNBUILT_TITLE}
              >
                <Text size="xs">
                  У письма нет связей: начните цепочку, назвав его ответом на другое письмо или
                  перетащив сюда другое письмо из этого же списка.
                </Text>
                {canMoveRoot && (
                  <Button size="xs" variant="light" mt="xs" onClick={() => setPickerOpen(true)}>
                    Выбрать, на что оно отвечает
                  </Button>
                )}
              </Alert>
            )}

            <DndContext
              sensors={sensors}
              // Указатель важнее геометрии: зоны сброса полосы в 16px, и «ближайший
              // центр» выбирал бы не ту строку, на которую указана мышь.
              collisionDetection={(args) => {
                const inside = pointerWithin(args);
                return inside.length > 0 ? inside : rectIntersection(args);
              }}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={() => {
                void handleDragEnd();
              }}
              onDragCancel={resetDrag}
            >
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
                <MailThreadGap
                  zoneId={mailGapDropId({ kind: 'head' })}
                  hint={MAIL_DROP_HINT_HEAD}
                  droppable={!!draggedKey}
                  overState={gapOverState(mailGapDropId({ kind: 'head' }))}
                  stacked={!wide}
                />

                {layout.nodes.map((node) => (
                  <div key={node.key}>
                    <MailThreadGap
                      zoneId={mailGapDropId({ kind: 'before', before: node.key })}
                      hint={MAIL_DROP_HINT_BEFORE}
                      droppable={!!draggedKey}
                      overState={gapOverState(mailGapDropId({ kind: 'before', before: node.key }))}
                      stacked={!wide}
                    />
                    <MailThreadNode
                      node={node}
                      direction={directions.get(node.key) ?? 'down'}
                      isAnchor={node.key === anchorKey}
                      isCyclic={cyclicKeys?.has(node.key) ?? false}
                      canDrag={canEditType(permissions, node.type)}
                      droppable={!!draggedKey}
                      overState={nodeOverState(node.key)}
                      stacked={!wide}
                      onGoToRegister={onGoToRegister}
                    />
                  </div>
                ))}

                <MailThreadGap
                  zoneId={mailGapDropId({ kind: 'tail' })}
                  hint={MAIL_DROP_HINT_TAIL}
                  droppable={!!draggedKey}
                  overState={gapOverState(mailGapDropId({ kind: 'tail' }))}
                  stacked={!wide}
                />
              </Box>
            </DndContext>

            {hasCycle && (
              <Alert
                color="yellow"
                variant="light"
                icon={<IconAlertTriangle size={16} />}
                title="Цепочка замыкается в кольцо"
              >
                <Text size="xs">{MAIL_CHAIN_CYCLE_NOTE}</Text>
              </Alert>
            )}

            {detached && layout.nodes.some((node) => node.key === detached.key) && (
              <Text size="xs" c="dimmed">
                {MAIL_DETACHED_LETTER_NOTE}
              </Text>
            )}

            {layout.skipped > 0 && (
              <Text size="xs" c="dimmed">
                {MAIL_CHAIN_TRUNCATION_NOTE(THREAD_MAX_DEPTH)}
              </Text>
            )}
          </Stack>
        )}
      </Modal>

      <MailThreadPrintModal
        key={printOpen ? 'open' : 'closed'}
        opened={printOpen}
        onClose={() => setPrintOpen(false)}
        orgId={orgId}
        nodes={layout?.nodes ?? []}
        wide={wide}
      />

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
