import type { ReactNode } from 'react';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/mocks/test-utils';
import type {
  IIncomingMail,
  IMailFile,
  IMailRelation,
  IOutgoingMail,
  MailType,
} from '@/shared/types';
import { MailThreadBuilder } from './MailThreadBuilder';
import { buildCandidateLookup, buildParentEdgeIndex } from './mail-parent';
import type { MailCandidate } from './mail-parent';
import {
  buildLetterIndex,
  buildMailThreadGraph,
  detectCyclicNodeKeys,
  mailNodeKey,
  THREAD_MAX_DEPTH,
} from './mail-thread';
import type { MailNodeKey } from './mail-thread';
import { mailGapDropId, mailNodeDropId, MAIL_TREE_INDENT } from './mail-thread-builder';
import { MAIL_CHAIN_TRUNCATION_NOTE, MAIL_DETACHED_LETTER_NOTE } from './mail-thread-labels';
import type { MailPermissions } from './mail-field-access';
import type { LinkChangeArgs } from './useMailLinkChange';

/**
 * Конструктор переписки: одна вертикальная линия, в которой перетаскивание
 * меняет настоящие связи.
 *
 * Разбор `mail_relations`, порядок соседей по дате и правила зон сброса живут в
 * `mail-thread.ts`, `mail-thread-builder.ts` и `mail-thread-order.ts` и закрыты
 * своими тестами. Здесь проверяется то, что принадлежит только конструктору:
 *
 *  1. **Что человек вообще видит.** Порядок узлов линии, глубину каждого письма,
 *     подписи направления, зоны сброса между ними, отметку о кольце, заметку об
 *     обрезанной ветке и заметку о письме, снятом с переписки. Ошибка здесь
 *     бесшумна: письмо не падает и не сообщает об ошибке — оно просто встаёт не
 *     туда, и переписка становится неверной, а не сломанной.
 *  2. **Разрешение сброса.** Три цели — на письмо, в промежуток, в начало или
 *     конец цепочки. Проверяется не только результат (`changeLink`/`place`), но и
 *     то, что недопустимая цель видна **до** отпускания: курсор становится
 *     `not-allowed`, и письмо туда не падает.
 *  3. **Откат.** Отказ смены связи не должен оставлять письмо на новом месте в
 *     порядке соседей — иначе следующая перерисовка покажет чужую переписку.
 *
 * Два решения, которые видно в замоках, и почему они именно такие:
 *
 * - **`@dnd-kit/core` подменён.** В jsdom у элементов нет геометрии, поэтому
 *   `pointerWithin`/`rectIntersection` не выбирают ни одной цели, а
 *   `PointerSensor` не срабатывает от синтетических событий. Подменён только
 *   транспорт: `DndContext` отдаёт обработчики, которые тест зовёт сам, и по
 *   тому же контракту, что и dnd-kit (`onDragStart` → `onDragOver` →
 *   `onDragEnd`). Всё под этим транспортом — `parseDropZone`, `resolveDrop`,
 *   `buildThreadLine`, `planLinkChange` — остаётся настоящим.
 * - **Данные подменены на уровне хуков, а не сети.** Граф, подписи, кольца,
 *   кандидаты и рёбра собираются настоящими `buildMailThreadGraph`,
 *   `buildLetterIndex`, `detectCyclicNodeKeys`, `buildCandidateLookup` и
 *   `buildParentEdgeIndex` из тех же строк `mail_relations`, что читает
 *   `useOrgMailThread`. Так тест управляет письмами и связями, а не HTTP.
 */

/** Обработчики контекста перетаскивания в том виде, в каком их шлёт dnd-kit. */
type DndHandlers = {
  onDragStart: (event: { active: { id: string } }) => void;
  onDragOver: (event: { over: { id: string } | null }) => void;
  onDragEnd: () => void;
  onDragCancel: () => void;
};

const state = vi.hoisted(() => ({
  thread: undefined as ReturnType<typeof buildThreadData> | undefined,
  /** Порядок соседей из настройки: ключ → позиция. Подменяется на лету. */
  ranks: new Map<string, number>(),
  files: [] as IMailFile[],
  /** Смена связи: успех или отказ — оба достижимы, оба проверяются. */
  changeLinkFails: false,
  place: vi.fn(),
  changeLink: vi.fn(),
  lastOrgId: '',
  handlers: null as DndHandlers | null,
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: DndHandlers & { children?: ReactNode }) => {
    // Обработчики перезаписываются на каждой отрисовке: снятый в замыкании
    // `draggedKey` иначе остался бы от прошлого рендера.
    state.handlers = props;
    return <>{props.children}</>;
  },
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useSensor: (sensor: unknown) => sensor,
  useSensors: (...sensors: unknown[]) => sensors,
  KeyboardSensor: 'KeyboardSensor',
  PointerSensor: 'PointerSensor',
  pointerWithin: () => [],
  rectIntersection: () => [],
}));

vi.mock('./useOrgMailThread', () => ({
  useOrgMailThread: (orgId: string) => {
    state.lastOrgId = orgId;
    return state.thread;
  },
}));

vi.mock('./useOrgMailFiles', () => ({
  useOrgMailFiles: () => ({ data: state.files, isLoading: false, isError: false }),
}));

vi.mock('./mail-thread-order', () => ({
  useMailThreadOrder: () => ({ order: {}, ranks: state.ranks, place: state.place }),
}));

vi.mock('./useMailLinkChange', () => ({
  useMailLinkChange: () => ({
    changeLink: async (args: LinkChangeArgs) => {
      if (state.changeLinkFails) throw new Error('связь не сохранена');
      return state.changeLink(args);
    },
    isPending: false,
  }),
}));

vi.mock('./MailThreadPrintModal', () => ({
  MailThreadPrintModal: ({ opened }: { opened: boolean }) =>
    opened ? <div data-testid="print-modal">Окно печати</div> : null,
}));

vi.mock('./MailParentPicker', () => ({
  MailParentPicker: ({
    opened,
    candidates,
    onSelect,
  }: {
    opened: boolean;
    candidates: { all: readonly MailCandidate[] };
    onSelect: (candidate: MailCandidate) => void;
  }) =>
    opened ? (
      <div data-testid="parent-picker">
        {candidates.all.map((candidate) => (
          <button key={candidate.key} type="button" onClick={() => onSelect(candidate)}>
            {`Выбрать ${candidate.number}`}
          </button>
        ))}
      </div>
    ) : null,
}));

// ─── Данные переписки ───

const ORG_ID = 'org0000000000001';

const inKey = (id: string): MailNodeKey => mailNodeKey('incoming', id);
const outKey = (id: string): MailNodeKey => mailNodeKey('outgoing', id);

function incoming(id: string, over: Partial<IIncomingMail> = {}): IIncomingMail {
  return {
    id,
    organization_id: ORG_ID,
    date: '2026-01-10',
    seq: 1,
    number: `ВХ-${id}`,
    subject: `Тема ${id}`,
    sender: `ООО «${id}»`,
    responsible: 'user1',
    ...over,
  };
}

function outgoing(id: string, over: Partial<IOutgoingMail> = {}): IOutgoingMail {
  return {
    id,
    organization_id: ORG_ID,
    date: '2026-01-10',
    seq: 1,
    outgoing_number: `И-${id}`,
    subject: `Тема ${id}`,
    recipient: `ООО «${id}»`,
    responsible: 'user1',
    ...over,
  };
}

/** Конец ребра из ключа графа — единственное место, где ключ снова разбирается. */
function edgeEnd(key: MailNodeKey): { type: MailType; id: string } {
  const separator = key.indexOf(':');
  return {
    type: key.slice(0, separator) === 'incoming' ? 'incoming' : 'outgoing',
    id: key.slice(separator + 1),
  };
}

/** Связь между двумя письмами: регистры могут совпадать, а могут и различаться. */
function link(id: string, parent: MailNodeKey, child: MailNodeKey): IMailRelation {
  const from = edgeEnd(parent);
  const to = edgeEnd(child);
  return {
    id,
    organization_id: ORG_ID,
    ...(from.type === 'outgoing'
      ? { parent_outgoing_mail_id: from.id }
      : { parent_incoming_mail_id: from.id }),
    ...(to.type === 'outgoing'
      ? { child_outgoing_mail_id: to.id }
      : { child_incoming_mail_id: to.id }),
  };
}

interface ThreadInput {
  readonly incoming?: readonly IIncomingMail[];
  readonly outgoing?: readonly IOutgoingMail[];
  readonly relations?: readonly IMailRelation[];
}

/**
 * Ровно то, что отдаёт `useOrgMailThread`, собранное настоящими сборщиками из
 * тех же строк связи: тест управляет письмами, а не HTTP-ответами.
 */
function buildThreadData(input: ThreadInput = {}) {
  const incomingMails = input.incoming ?? [];
  const outgoingMails = input.outgoing ?? [];
  const relations = input.relations ?? [];
  const letters = buildLetterIndex(incomingMails, outgoingMails);
  const graph = buildMailThreadGraph(relations, letters);
  return {
    letters,
    graph,
    cyclicKeys: detectCyclicNodeKeys(graph),
    candidates: buildCandidateLookup(incomingMails, outgoingMails),
    parentEdges: buildParentEdgeIndex(relations),
    isLoading: false,
    isError: false,
  };
}

function mailFile(id: string, mailId: string, over: Partial<IMailFile> = {}): IMailFile {
  return {
    id,
    mail_id: mailId,
    mail_type: 'incoming',
    organization_id: ORG_ID,
    file: [`${id}.pdf`],
    name: `${id}.pdf`,
    ...over,
  };
}

// ─── Права ───

const ALL_PERMISSIONS: MailPermissions = {
  canView: true,
  canCreateIncoming: true,
  canEditIncoming: true,
  canDeleteIncoming: true,
  canCreateOutgoing: true,
  canEditOutgoing: true,
  canDeleteOutgoing: true,
  canManageFiles: true,
  canViewHistory: true,
  canRestore: true,
  canViewArchive: true,
};

const READ_ONLY_PERMISSIONS: MailPermissions = {
  ...ALL_PERMISSIONS,
  canCreateIncoming: false,
  canEditIncoming: false,
  canDeleteIncoming: false,
  canCreateOutgoing: false,
  canEditOutgoing: false,
  canDeleteOutgoing: false,
  canManageFiles: false,
};

type BuilderProps = Parameters<typeof MailThreadBuilder>[0];

// ─── Показатели линии ───

const line = () => {
  const found = document.querySelector('[data-mail-line]');
  if (!found) throw new Error('линия переписки не отрисована');
  return found;
};

/** Ключи писем в порядке показа сверху вниз — это и есть переписка, которую читают. */
function lineKeys(): string[] {
  return [...line().querySelectorAll('[data-mail-node]')].map(
    (element) => element.getAttribute('data-mail-node') ?? '',
  );
}

/** Идентификаторы зон сброса в порядке показа: над первой, между, под последней. */
function gapIds(): string[] {
  return [...line().querySelectorAll('[data-mail-gap]')].map(
    (element) => element.getAttribute('data-mail-gap') ?? '',
  );
}

function node(key: MailNodeKey): HTMLElement {
  const found = line().querySelector(`[data-mail-node="${key}"]`);
  if (!found) throw new Error(`письма ${key} нет в линии`);
  return found as HTMLElement;
}

/**
 * Длина ответвления линии к письму. Ответвление рисуется только у письма с
 * ненулевой глубиной и растёт ровно на шаг вложенности, поэтому по нему и
 * читается глубина: у первого письма цепочки ответвления нет вовсе.
 */
function branchOf(key: MailNodeKey): number | null {
  for (const element of node(key).querySelectorAll<HTMLElement>('*')) {
    if (element.style.height !== '2px') continue;
    const width = element.style.width;
    return width.endsWith('px') ? Number.parseFloat(width) : null;
  }
  return null;
}

/** Длина ответвления, а ноль — когда письмо стоит в начале цепочки. */
function branchWidth(key: MailNodeKey): number {
  return branchOf(key) ?? 0;
}

const cursor = () => document.body.style.cursor;

// ─── Перетаскивание ───

/**
 * События идут отдельными `act`, как их шлёт dnd-kit: обработчик отпускания
 * берёт `draggedKey` из замыкания, поэтому в том же пакете он ещё был бы `null`.
 */
async function hover(dragged: MailNodeKey, overId: string): Promise<void> {
  await act(async () => {
    state.handlers?.onDragStart({ active: { id: dragged } });
  });
  await act(async () => {
    state.handlers?.onDragOver({ over: { id: overId } });
  });
}

async function endDrag(): Promise<void> {
  await act(async () => {
    state.handlers?.onDragEnd();
  });
}

async function drop(dragged: MailNodeKey, overId: string): Promise<void> {
  await hover(dragged, overId);
  await endDrag();
}

// ─── Отрисовка ───

function builderElement(overrides: Partial<BuilderProps> = {}) {
  return (
    <MailThreadBuilder
      opened
      onClose={vi.fn()}
      orgId={ORG_ID}
      rootMailId="b"
      rootMailType="incoming"
      permissions={ALL_PERMISSIONS}
      {...overrides}
    />
  );
}

function renderBuilder(overrides: Partial<BuilderProps> = {}) {
  return renderWithProviders(builderElement(overrides));
}

// ─── Готовые переписки ───

const CHAIN_LETTERS = [
  incoming('a', { date: '2026-01-10', seq: 1 }),
  incoming('b', { date: '2026-01-11', seq: 2 }),
  incoming('c', { date: '2026-01-12', seq: 3 }),
];

/** `a → b → c`, открыто среднее письмо `b`: линия сверху вниз — `a`, `b`, `c`. */
function chainThroughAnchor(): void {
  state.thread = buildThreadData({
    incoming: CHAIN_LETTERS,
    relations: [link('r1', inKey('a'), inKey('b')), link('r2', inKey('b'), inKey('c'))],
  });
}

/** `a → {x, y, z}`: три ответа одному письму, порядок соседей задают даты. */
function repliesToOneLetter(): void {
  state.thread = buildThreadData({
    incoming: [
      incoming('a', { date: '2026-01-10', seq: 1 }),
      incoming('x', { date: '2026-03-01', seq: 2 }),
      incoming('y', { date: '2026-02-01', seq: 3 }),
      incoming('z', { date: '2026-01-01', seq: 4 }),
    ],
    relations: [
      link('r1', inKey('a'), inKey('x')),
      link('r2', inKey('a'), inKey('y')),
      link('r3', inKey('a'), inKey('z')),
    ],
  });
}

/** Цепочка длиннее предела обхода: обход упрётся, а письма останутся в линии. */
function chainBeyondDepthLimit(): void {
  const long = Array.from({ length: THREAD_MAX_DEPTH + 3 }, (_, index) =>
    incoming(`m${index}`, { seq: index + 1 }),
  );
  state.thread = buildThreadData({
    incoming: long,
    relations: long
      .slice(1)
      .map((_, index) => link(`r${index}`, inKey(`m${index}`), inKey(`m${index + 1}`))),
  });
}

beforeEach(() => {
  document.body.style.cursor = '';
  state.ranks = new Map();
  state.files = [];
  state.changeLinkFails = false;
  state.lastOrgId = '';
  state.handlers = null;
  state.place.mockClear();
  state.changeLink.mockClear();
  chainThroughAnchor();
});

// ─── Тесты ───

describe('MailThreadBuilder — линия переписки', () => {
  it('цепочка выстроена в одну линию: предок выше, потомок ниже открытого письма', () => {
    renderBuilder();

    expect(lineKeys()).toEqual(['incoming:a', 'incoming:b', 'incoming:c']);
    expect(within(node(inKey('a'))).getByText('начало цепочки')).toBeInTheDocument();
    expect(within(node(inKey('b'))).getByText('текущее письмо')).toBeInTheDocument();
    expect(within(node(inKey('c'))).getByText('ответ')).toBeInTheDocument();
  });

  it('глубина растёт по шагам цепочки: ответвление линии длиннее на один шаг', () => {
    renderBuilder();

    // У первого письма ответвления нет вовсе — оно начинает цепочку, и
    // вложенность ему не на чем показывать.
    expect(branchOf(inKey('a'))).toBeNull();
    expect(branchWidth(inKey('b'))).toBeGreaterThan(0);
    expect(branchWidth(inKey('c')) - branchWidth(inKey('b'))).toBe(MAIL_TREE_INDENT);
  });

  it('зоны сброса стоят над первой, между каждыми и под последней — ни одной лишней', () => {
    renderBuilder();

    expect(gapIds()).toEqual([
      'gap:head',
      'gap:before:incoming:a',
      'gap:before:incoming:b',
      'gap:before:incoming:c',
      'gap:tail',
    ]);
  });

  it('письмо без связей показывается с приглашением построить цепочку, а не с пустотой', () => {
    state.thread = buildThreadData({ incoming: [incoming('b')] });
    renderBuilder();

    expect(lineKeys()).toEqual(['incoming:b']);
    expect(screen.getByText('Переписка не выстроена')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выбрать, на что оно отвечает' })).toBeInTheDocument();
  });

  it('построенная переписка не предлагает построить её заново', () => {
    renderBuilder();

    expect(screen.queryByText('Переписка не выстроена')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Выбрать, на что оно отвечает' }),
    ).not.toBeInTheDocument();
  });

  it('письмо, о котором не знает ни одна связь, в линию не попадает', () => {
    // Реестр организации полон писем, но переписку строят только связи: молча
    // выведенное в линию постороннее письмо выглядело бы как начало цепочки.
    state.thread = buildThreadData({
      incoming: [incoming('a'), incoming('b'), incoming('unrelated')],
      relations: [link('r1', inKey('a'), inKey('b'))],
    });
    renderBuilder({ rootMailId: 'a' });

    expect(lineKeys()).toEqual(['incoming:a', 'incoming:b']);
  });

  it('связь на удалённое письмо не теряется: в линии появляется корень без подписей', () => {
    // Самое дорогое и самое тихое: родителя письма в регистре уже нет, связь на
    // него осталась. Рёбра строятся по строкам `mail_relations`, поэтому письмо
    // не выбрасывается, а встаёт началом цепочки — и говорит, что подписей нет.
    state.thread = buildThreadData({
      incoming: [incoming('b')],
      relations: [link('r1', outKey('ghost'), inKey('b'))],
    });
    renderBuilder();

    expect(lineKeys()).toEqual(['outgoing:ghost', 'incoming:b']);
    expect(
      within(node(outKey('ghost'))).getByText(
        'Письмо недоступно — связь ссылается на удалённое письмо',
      ),
    ).toBeInTheDocument();
  });

  it('удалённый ответ остаётся в линии и не мешает считать переписку построенной', () => {
    // Обратная сторона того же случая: пропавший ребёнок — это всё ещё связь, и
    // подсказка «переписка не выстроена» здесь была бы враньём.
    state.thread = buildThreadData({
      incoming: [incoming('a')],
      relations: [link('r1', inKey('a'), inKey('gone'))],
    });
    renderBuilder({ rootMailId: 'a' });

    expect(lineKeys()).toEqual(['incoming:a', 'incoming:gone']);
    expect(screen.queryByText('Переписка не выстроена')).not.toBeInTheDocument();
  });

  it('кольцо A → B → A показывается целиком, по одному разу, с отметкой о кольцо', () => {
    state.thread = buildThreadData({
      incoming: [incoming('a', { date: '2026-01-10' }), incoming('b', { date: '2026-01-11' })],
      relations: [link('r1', inKey('a'), inKey('b')), link('r2', inKey('b'), inKey('a'))],
    });
    renderBuilder({ rootMailId: 'a' });

    // Связи в базе от кольца не защищены, и обход обязан его пережить: письмо не
    // показывается второй раз, иначе линия разошлась бы в бесконечную рекурсию
    // прямо в отрисовке.
    expect(lineKeys()).toEqual(['incoming:b', 'incoming:a']);
    expect(screen.getByText('Цепочка замыкается в кольцо')).toBeInTheDocument();
    expect(screen.getAllByText('кольцо')).toHaveLength(2);
  }, 5000);

  it('письмо, связанное с самим собой, не уводит разметку в цикл', () => {
    state.thread = buildThreadData({
      incoming: [incoming('a')],
      relations: [link('r1', inKey('a'), inKey('a'))],
    });
    renderBuilder({ rootMailId: 'a' });

    // Ребро «сам на себя» на записи не запрещено, поэтому предел обхода и
    // отметка о посещённом здесь единственная защита: письмо показано один раз.
    expect(lineKeys()).toEqual(['incoming:a']);
    expect(screen.getByText(MAIL_CHAIN_TRUNCATION_NOTE(THREAD_MAX_DEPTH))).toBeInTheDocument();
  }, 5000);

  it('хвост ветки за пределом обхода не теряется — он показан своими цепочками', () => {
    chainBeyondDepthLimit();
    renderBuilder({ rootMailId: 'm0' });

    // Предел глубины прячет не письмо, а вложенность: недойденные письма
    // встают отдельными корнями. Иначе счётчик «пропущено» объяснял бы
    // отсутствие пустым местом в линии.
    expect(lineKeys()).toHaveLength(THREAD_MAX_DEPTH + 3);
    expect(branchOf(inKey(`m${THREAD_MAX_DEPTH - 1}`))).not.toBeNull();
    expect(branchOf(inKey(`m${THREAD_MAX_DEPTH}`))).toBeNull();
    expect(branchOf(inKey(`m${THREAD_MAX_DEPTH + 2}`))).toBeNull();
    expect(screen.getByText(MAIL_CHAIN_TRUNCATION_NOTE(THREAD_MAX_DEPTH))).toBeInTheDocument();
  });

  it('обрезанной ветки нет — нет и заметки о ней', () => {
    renderBuilder();

    expect(lineKeys()).toHaveLength(3);
    expect(screen.queryByText(MAIL_CHAIN_TRUNCATION_NOTE(THREAD_MAX_DEPTH))).not.toBeInTheDocument();
  });
});

describe('MailThreadBuilder — порядок соседей', () => {
  it('без сохранённого порядка соседи стоят в порядке реестра', () => {
    repliesToOneLetter();
    renderBuilder({ rootMailId: 'a' });

    // Даты и `seq` — единственное, что есть в связях: `x` отвечает позже всех и
    // стоит первым ответом.
    expect(lineKeys()).toEqual(['incoming:a', 'incoming:x', 'incoming:y', 'incoming:z']);
  });

  it('ранги из настройки перевешивают дату и меняют порядок ответов', () => {
    repliesToOneLetter();
    const view = renderBuilder({ rootMailId: 'a' });

    // Порядок между соседями по датам не восстанавливается — это решение
    // человека. Если бы настройка не перевешивала дату, перетаскивание было бы
    // бессмысленным: линия перерисовалась бы сама и вернула всё на место.
    state.ranks = new Map([
      [inKey('y'), 0],
      [inKey('x'), 1],
      [inKey('z'), 2],
    ]);
    view.rerender(builderElement({ rootMailId: 'a' }));

    expect(lineKeys()).toEqual(['incoming:a', 'incoming:y', 'incoming:x', 'incoming:z']);
  });

  it('порядок в настройке меняет линию на лету, без переоткрытия окна', () => {
    repliesToOneLetter();
    const view = renderBuilder({ rootMailId: 'a' });
    expect(lineKeys().indexOf(inKey('z'))).toBe(3);

    state.ranks = new Map([
      [inKey('z'), 0],
      [inKey('x'), 1],
      [inKey('y'), 2],
    ]);
    view.rerender(builderElement({ rootMailId: 'a' }));

    expect(lineKeys()).toEqual(['incoming:a', 'incoming:z', 'incoming:x', 'incoming:y']);
  });

  it('письмо вне настройки не теряется: оно встаёт после перечисленных', () => {
    repliesToOneLetter();
    state.ranks = new Map([[inKey('z'), 0]]);
    renderBuilder({ rootMailId: 'a' });

    // Ранга нет у `x` и `y`, но выкинуть их из линии нельзя: перетащить письмо,
    // которого не видно, невозможно, и оно потерялось бы навсегда.
    expect(lineKeys()).toEqual(['incoming:a', 'incoming:z', 'incoming:x', 'incoming:y']);
  });
});

describe('MailThreadBuilder — разрешение сброса', () => {
  it('сброс на соседнее письмо делает его ответом, а новое место — последним среди ответов', async () => {
    renderBuilder();

    await drop(inKey('c'), mailNodeDropId(inKey('a')));

    // Прежняя связь `b → c` снимается и создаётся `a → c`: план собран из
    // сохранённых рёбер, а не из номеров, а дети нового родителя приходят из
    // раскладки, а не из базы.
    expect(state.changeLink).toHaveBeenCalledWith({
      child: { id: 'c', type: 'incoming' },
      plan: {
        drop: [expect.objectContaining({ parent: expect.objectContaining({ key: inKey('b') }) })],
        create: expect.objectContaining({ key: inKey('a') }),
      },
    });
    expect(state.place).toHaveBeenCalledWith(inKey('c'), inKey('a'), { kind: 'last' }, [inKey('b')]);
  });

  it('сброс на прежнего родителя меняет только место среди соседей и не пишет связь', async () => {
    renderBuilder();

    await drop(inKey('c'), mailNodeDropId(inKey('b')));

    // Родитель тот же — связи не касаемся, иначе в истории письма появились бы
    // две записи `unlinked`/`linked` при неизменном результате.
    expect(state.changeLink).not.toHaveBeenCalled();
    expect(state.place).not.toHaveBeenCalled();
  });

  it('сброс на самого себя отклоняется: письмо не может отвечать на себя', async () => {
    renderBuilder();

    await hover(inKey('c'), mailNodeDropId(inKey('c')));
    expect(cursor()).toBe('not-allowed');

    await endDrag();
    expect(state.changeLink).not.toHaveBeenCalled();
    expect(state.place).not.toHaveBeenCalled();
  });

  it('сброс на собственного потомка отклоняется: иначе цепочка замкнётся в кольцо', async () => {
    renderBuilder();

    // `a` — предок `c`, поэтому сброс `a` на `c` замкнул бы кольцо. Отказ виден
    // до отпускания, иначе «письмо пропало» читалось бы как потеря связи.
    await hover(inKey('a'), mailNodeDropId(inKey('c')));
    expect(cursor()).toBe('not-allowed');

    await endDrag();
    expect(state.changeLink).not.toHaveBeenCalled();
    expect(state.place).not.toHaveBeenCalled();
  });

  it('допустимая цель отвечает курсором `grabbing` уже во время перетаскивания', async () => {
    renderBuilder();

    await hover(inKey('c'), mailNodeDropId(inKey('a')));
    expect(cursor()).toBe('grabbing');

    await endDrag();
    // Курсор возвращается телу документа, а не остаётся висеть на странице.
    expect(cursor()).toBe('');
  });

  it('зона, под которой стоит курсор, помечена в самой линии', async () => {
    renderBuilder();

    await hover(inKey('c'), mailGapDropId({ kind: 'before', before: inKey('b') }));

    expect(line()).toHaveAttribute('data-mail-over', 'gap:before:incoming:b');
  });

  it('промежуток над первым письмом снимает связь и начинает новую цепочку первым', async () => {
    renderBuilder();

    await drop(inKey('c'), mailGapDropId({ kind: 'head' }));

    expect(state.changeLink).toHaveBeenCalledWith({
      child: { id: 'c', type: 'incoming' },
      plan: { drop: [expect.anything()], create: null },
    });
    // Соседи нового родителя — начала цепочек, а не пустой список: `a` тоже
    // стоит без родителя и занимает в них первое место.
    expect(state.place).toHaveBeenCalledWith(inKey('c'), null, { kind: 'first' }, [inKey('a')]);
  });

  it('промежуток под последним письмом начинает цепочку последним', async () => {
    renderBuilder();

    await drop(inKey('b'), mailGapDropId({ kind: 'tail' }));

    expect(state.place).toHaveBeenCalledWith(inKey('b'), null, { kind: 'last' }, [inKey('a')]);
  });

  it('промежуток между соседями двигает письмо среди них, не меняя родителя', async () => {
    repliesToOneLetter();
    renderBuilder({ rootMailId: 'a' });

    // `x`, `y`, `z` — соседи одного родителя, поэтому промежуток перед `y`
    // означает «встать вторым среди ответов на `a`», а не «стать ответом `x`».
    await drop(inKey('z'), mailGapDropId({ kind: 'before', before: inKey('y') }));

    expect(state.place).toHaveBeenCalledWith(
      inKey('z'),
      inKey('a'),
      { kind: 'at', index: 1 },
      [inKey('x'), inKey('y'), inKey('z')],
    );
    expect(state.changeLink).not.toHaveBeenCalled();
  });

  it('промежуток перед первым ответом недопустим: там цепочка ещё не началась', async () => {
    repliesToOneLetter();
    renderBuilder({ rootMailId: 'a' });

    // Между `a` и `x` стоял бы ответ на цепочку, которой нет: место под `a`
    // принадлежит настоящему началу, а не промежутку между строками.
    await hover(inKey('z'), mailGapDropId({ kind: 'before', before: inKey('x') }));

    expect(cursor()).toBe('not-allowed');
  });

  it('промежуток над самым верхним письмом недопустим: для этого есть отдельная зона', async () => {
    renderBuilder();

    await hover(inKey('c'), mailGapDropId({ kind: 'before', before: inKey('a') }));

    expect(cursor()).toBe('not-allowed');
  });

  it('отказ смены связи не оставляет письмо на новом месте в порядке соседей', async () => {
    renderBuilder();
    state.changeLinkFails = true;

    await drop(inKey('c'), mailNodeDropId(inKey('a')));

    // Связь не записалась — значит, и место в порядке соседей менять нельзя:
    // иначе следующая перерисовка показала бы чужую переписку.
    expect(state.place).not.toHaveBeenCalled();
    expect(lineKeys()).toEqual(['incoming:a', 'incoming:b', 'incoming:c']);
  });

  it('отмена перетаскивания оставляет линию ровно такой, какой была', async () => {
    renderBuilder();
    await hover(inKey('c'), mailNodeDropId(inKey('a')));

    await act(async () => {
      state.handlers?.onDragCancel();
    });

    expect(cursor()).toBe('');
    expect(state.changeLink).not.toHaveBeenCalled();
    expect(state.place).not.toHaveBeenCalled();
    expect(lineKeys()).toEqual(['incoming:a', 'incoming:b', 'incoming:c']);
  });

  it('сброс письма, ушедшего из линии между началом и отпусканием, ничего не пишет', async () => {
    // Переписку перечитали, пока письмо висело на курсоре: сбрасывать уже
    // нечего, а запись по старой раскладке сделала бы связь с пустотой.
    const view = renderBuilder();
    await hover(inKey('c'), mailGapDropId({ kind: 'head' }));
    expect(state.place).not.toHaveBeenCalled();

    state.thread = buildThreadData({
      incoming: CHAIN_LETTERS,
      relations: [link('r1', inKey('a'), inKey('b'))],
    });
    view.rerender(builderElement());

    await endDrag();
    expect(state.changeLink).not.toHaveBeenCalled();
    expect(state.place).not.toHaveBeenCalled();
  });
});

describe('MailThreadBuilder — письмо, снятое с переписки', () => {
  it('письмо, начавшее свою цепочку, остаётся в линии и об этом сказано вслух', async () => {
    // Человек только что поставил письмо в линию и ждёт, что оно там есть:
    // увести его молча — значит показать «письмо пропало» там, где он ничего не
    // терял.
    renderBuilder();
    await drop(inKey('c'), mailGapDropId({ kind: 'head' }));

    // Пока связь не перерисовалась, письмо ещё в графе — дописывать его второй
    // раз нельзя, иначе оно оказалось бы в линии дважды.
    expect(lineKeys()).toEqual(['incoming:a', 'incoming:b', 'incoming:c']);
    expect(screen.getByText(MAIL_DETACHED_LETTER_NOTE)).toBeInTheDocument();
  });

  it('как только связь исчезла, письмо дорисовывается последним корнем', async () => {
    const view = renderBuilder();
    await drop(inKey('c'), mailGapDropId({ kind: 'head' }));

    // Граф перечитан без связи `b → c`: письма в линии больше нет, и заметка о
    // нём была бы враньём, если бы оно не появилось снова.
    state.thread = buildThreadData({
      incoming: CHAIN_LETTERS,
      relations: [link('r1', inKey('a'), inKey('b'))],
    });
    view.rerender(builderElement());

    expect(lineKeys()).toEqual(['incoming:a', 'incoming:b', 'incoming:c']);
    expect(branchOf(inKey('c'))).toBeNull();
    expect(screen.getByText(MAIL_DETACHED_LETTER_NOTE)).toBeInTheDocument();
  });

  it('открытое письмо, снятое в начало цепочки, не считается снятым с переписки', async () => {
    // Якорь человек открыл сам: он остаётся в линии по праву открытия, и
    // дописывать его в конец было бы второй копией.
    renderBuilder();
    await drop(inKey('b'), mailGapDropId({ kind: 'tail' }));

    expect(state.place).toHaveBeenCalledWith(inKey('b'), null, { kind: 'last' }, [inKey('a')]);
    expect(screen.queryByText(MAIL_DETACHED_LETTER_NOTE)).not.toBeInTheDocument();
  });
});

describe('MailThreadBuilder — права и подсказки', () => {
  it('без права править письма нет ни подсказки, ни ручек перетаскивания', () => {
    renderBuilder({ permissions: READ_ONLY_PERMISSIONS });

    expect(screen.queryByText(/Перетащите письмо на другое/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Перетащить письмо/ })).not.toBeInTheDocument();
    expect(lineKeys()).toHaveLength(3);
  });

  it('право на один регистр даёт ручку только письмам этого регистра', () => {
    state.thread = buildThreadData({
      incoming: [incoming('a')],
      outgoing: [outgoing('b')],
      relations: [link('r1', inKey('a'), outKey('b'))],
    });
    renderBuilder({
      rootMailId: 'a',
      permissions: { ...ALL_PERMISSIONS, canEditOutgoing: false },
    });

    expect(screen.getByRole('button', { name: 'Перетащить письмо: ВХ-a' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Перетащить письмо: И-b' })).not.toBeInTheDocument();
  });

  it('подсказка про перетаскивание обещана только тем, кто вправе двигать', () => {
    const view = renderBuilder({ permissions: READ_ONLY_PERMISSIONS });
    expect(screen.queryByText(/Перетащите письмо на другое/)).not.toBeInTheDocument();

    view.rerender(builderElement());
    expect(screen.getByText(/Перетащите письмо на другое/)).toBeInTheDocument();
  });

  it('переход к письму в реестре уходит с его идентификатором, регистром и датой', async () => {
    const user = userEvent.setup();
    const onGoToRegister = vi.fn();
    renderBuilder({ onGoToRegister });

    await user.click(screen.getByRole('button', { name: 'Перейти к письму в реестре: ВХ-c' }));

    expect(onGoToRegister).toHaveBeenCalledWith('c', 'incoming', '2026-01-12');
  });

  it('без обработчика перехода иконок поиска нет вовсе', () => {
    renderBuilder();

    expect(
      screen.queryByRole('button', { name: /^Перейти к письму в реестре/ }),
    ).not.toBeInTheDocument();
  });

  it('выбрать родителя без права правки нельзя, и кнопки не будет', () => {
    state.thread = buildThreadData({ incoming: [incoming('b')] });
    renderBuilder({ permissions: READ_ONLY_PERMISSIONS });

    expect(screen.getByText('Переписка не выстроена')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Выбрать, на что оно отвечает' }),
    ).not.toBeInTheDocument();
  });
});

describe('MailThreadBuilder — состояние окна', () => {
  it('заголовок называет дату и номер открытого письма', () => {
    renderBuilder();

    expect(screen.getByText('Переписка: 11.01.2026 · ВХ-b')).toBeInTheDocument();
  });

  it('письма, которого нет в регистре, заголовок не выдумывает: он называет регистр', () => {
    state.thread = buildThreadData({ relations: [] });
    renderBuilder();

    expect(screen.getByText('Переписка: Входящее письмо')).toBeInTheDocument();
  });

  it('пока грузятся связи, виден индикатор, а не пустая переписка', () => {
    state.thread = { ...buildThreadData({ relations: [] }), isLoading: true };
    const { container } = renderBuilder();

    expect(container.querySelector('.mantine-Loader-root')).toBeInTheDocument();
    expect(screen.queryByText('Переписка не выстроена')).not.toBeInTheDocument();
  });

  it('неудачная загрузка говорит прямо, а не показывает пустую переписку', () => {
    state.thread = { ...buildThreadData({ relations: [] }), isError: true };
    renderBuilder();

    expect(screen.getByText('Не удалось загрузить переписку')).toBeInTheDocument();
    expect(screen.queryByText('Переписка не выстроена')).not.toBeInTheDocument();
  });

  it('закрытое окно не спрашивает переписку организации', () => {
    renderBuilder({ opened: false });

    // Пустая организация отключает запрос, а не грузит его вхолостую: у закрытого
    // окна нет причины читать письма организации.
    expect(state.lastOrgId).toBe('');
  });

  it('открытое окно спрашивает именно свою организацию', () => {
    renderBuilder();

    expect(state.lastOrgId).toBe(ORG_ID);
  });

  it('кнопка печати считает файлы только тех писем, что стоят в линии', async () => {
    const user = userEvent.setup();
    state.files = [mailFile('f1', 'a'), mailFile('f2', 'c'), mailFile('f3', 'nowhere')];
    renderBuilder();

    // Вложение письма вне линии не печатается: печать обязана повторять
    // показанное, иначе в пакете окажется письмо, которого человек не видел.
    expect(screen.getByRole('button', { name: 'Печать вложений (2)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Печать вложений (2)' }));
    expect(screen.getByTestId('print-modal')).toBeInTheDocument();
  });

  it('без вложений кнопки печати нет: открывать нечего', () => {
    renderBuilder();

    expect(screen.queryByRole('button', { name: /^Печать вложений/ })).not.toBeInTheDocument();
  });

  it('выбранный вручную родитель записывается связью на открытое письмо', async () => {
    const user = userEvent.setup();
    state.thread = buildThreadData({
      incoming: [incoming('b', { date: '2026-01-11' }), incoming('older', { date: '2026-01-05' })],
    });
    renderBuilder();

    await user.click(screen.getByRole('button', { name: 'Выбрать, на что оно отвечает' }));
    await user.click(
      within(screen.getByTestId('parent-picker')).getByRole('button', { name: 'Выбрать ВХ-older' }),
    );

    expect(state.changeLink).toHaveBeenCalledWith({
      child: { id: 'b', type: 'incoming' },
      plan: { drop: [], create: expect.objectContaining({ key: inKey('older') }) },
    });
  });
});
