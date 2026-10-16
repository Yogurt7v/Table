import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import type { MailLetter, MailNodeKey } from './mail-thread';
import { mailNodeKey } from './mail-thread';
import { MailThreadGap, MailThreadNode } from './MailThreadNode';
import type { ThreadDirection, ThreadLineNode, ThreadOverState } from './mail-thread-builder';
import { MAIL_TREE_INDENT, mailGapDropId, mailNodeDropId } from './mail-thread-builder';
import { MAIL_DROP_HINT_BEFORE, MAIL_DROP_HINT_HEAD } from './mail-thread-labels';
import { MAIL_EMPTY_CELL } from './mail-labels';

/**
 * Строка линии переписки: то, чем человек читает вложенность и права.
 *
 * Разметку (`ThreadLineNode`, глубины, идентификаторы зон) считает
 * `mail-thread-builder.ts` и проверяет `mail-thread-builder.test.ts`; права
 * письма выводит `MailThreadBuilder.test.tsx`. Здесь закрыто то, что
 * принадлежит только самой строке и молчит при ошибке:
 *
 *  1. **Глубина становится видимой.** Отступ письма и длина ответвления линии
 *     растут от `node.depth`. Ошибка здесь не падает: строка рисуется, выглядит
 *     правдоподобно, и человек восстанавливает по ней переписку, которой нет.
 *  2. **Ворота прав.** `canDrag` решает, предлагать ли ручку перетаскивания,
 *     `droppable` — регистрировать ли письмо целью сброса. Ошибка не
 *     косметическая: она либо отдаёт переупорядочивание тому, кому нельзя, либо
 *     блокирует того, кому можно.
 *  3. **Подпись письма.** `letterLabel` — запасной путь, когда письма нет в
 *     индексе или номер пуст; неверная запасная подпись выдумывает текст,
 *     которого в регистре не было.
 *
 * Три решения, которые видно в моках и в подаче тестов.
 *
 * - **`@dnd-kit/core` подменён** — той же формы, что и в
 *   `MailThreadBuilder.test.tsx`: в jsdom у элементов нет геометрии, поэтому
 *   `pointerWithin`/`rectIntersection` не выбирают цели, а `PointerSensor` не
 *   срабатывает от синтетических событий. Но в этой строке dnd-kit читается
 *   иначе: нужно видеть, с какими `id` и `disabled` компонент **регистрирует**
 *   себя, — поэтому мок не подменяет результат, а записывает аргументы и
 *   отвечает как библиотека: выключенный источник не едет за курсором. Зато
 *   `CSS.Transform` из `@dnd-kit/utilities` остаётся настоящим — `transform`
 *   считает сам `@dnd-kit`.
 * - **Реквизиты меняются через `change` на том же узле отрисовки, а не вторым
 *   `render`.** Два `render` в одном тесте оставляют в теле документа две
 *   строки, и любой поиск по документу находит первую — то есть уже
 *   неактуальную. Именно так выглядел бы и сбой прав: перерисованная строка,
 *   за которой осталась старая.
 * - **`change` правит только названные реквизиты.** Сброс остальных к
 *   значениям по умолчанию означал бы, что тест проверяет не переключение
 *   права, а совершенно другое письмо: глубина, ради которой переключали
 *   направление, тихо возвращалась к нулю, и проверка «отступ не зависит от
 *   направления» проходила бы на двух разных письмах.
 *
 * Фикстуры письма строятся здесь, а не берутся из `src/mocks/seed.ts`: тот seed
 * описывает организации, счета и платёжные отметки, а писем и связей между ними
 * в нём нет, и выдумывать их ради одного файла значило бы разойтись с
 * настоящими типами `MailLetter`/`ThreadLineNode`.
 */

// ─── Транспорт перетаскивания ───

/**
 * Регистрации компонента в dnd-kit. Мок пишет сюда то, что строка сдала
 * библиотеке, — и это единственный способ увидеть `disabled`: выключенная зона
 * в разметке неотличима от включённой, а именно она решает, примет ли письмо
 * сброс.
 */
const dnd = vi.hoisted(() => ({
  draggable: [] as { id: string; disabled: boolean }[],
  droppable: [] as { id: string; disabled: boolean }[],
  /** Ключ письма, которое сейчас «висит на курсоре»; `null` — перетаскивания нет. */
  draggingKey: null as string | null,
}));

vi.mock('@dnd-kit/core', () => ({
  useDraggable: (args: { id: string; disabled: boolean }) => {
    dnd.draggable.push(args);
    const active = dnd.draggingKey === args.id && !args.disabled;
    return {
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: active ? { x: 40, y: 60, scaleX: 1, scaleY: 1 } : null,
      isDragging: active,
    };
  },
  useDroppable: (args: { id: string; disabled: boolean }) => {
    dnd.droppable.push(args);
    return { setNodeRef: () => {}, isOver: false };
  },
}));

/** Источники, которые dnd-kit принял: выключенный из списка уходит. */
function dragSources(): string[] {
  return dnd.draggable.filter((source) => !source.disabled).map((source) => source.id);
}

/** Цели сброса, которые dnd-kit принял: выключенная зона в списке не значит цели. */
function dropTargets(): string[] {
  return dnd.droppable.filter((zone) => !zone.disabled).map((zone) => zone.id);
}

// ─── Данные ───

const key = (type: 'incoming' | 'outgoing', id: string): MailNodeKey => mailNodeKey(type, id);

const IN = key('incoming', 'a');
const HEAD_ZONE = mailGapDropId({ kind: 'head' });
const TAIL_ZONE = mailGapDropId({ kind: 'tail' });
const BEFORE_ZONE = mailGapDropId({ kind: 'before', before: IN });

/** Письмо, удалённое из регистра, — то, ради чего существует запасная подпись. */
const MISSING_LETTER_TEXT = 'Письмо недоступно — связь ссылается на удалённое письмо';

function letterOf(over: Partial<MailLetter> = {}): MailLetter {
  return {
    key: IN,
    date: '2026-01-10',
    seq: 1,
    number: 'ВХ-1',
    counterparty: 'ООО «Ромашка»',
    subject: 'Тема письма',
    ...over,
  };
}

function nodeOf(over: Partial<ThreadLineNode> = {}): ThreadLineNode {
  return {
    key: IN,
    type: 'incoming',
    id: 'a',
    depth: 0,
    parentKey: null,
    letter: letterOf(),
    index: 0,
    ...over,
  };
}

type NodeProps = Parameters<typeof MailThreadNode>[0];
type GapProps = Parameters<typeof MailThreadGap>[0];

const NODE_DEFAULTS: NodeProps = {
  node: nodeOf(),
  direction: 'down',
  isAnchor: false,
  isCyclic: false,
  canDrag: false,
  droppable: false,
  overState: 'none',
  stacked: false,
};

const GAP_DEFAULTS: GapProps = {
  zoneId: HEAD_ZONE,
  hint: MAIL_DROP_HINT_HEAD,
  droppable: false,
  overState: 'none',
  stacked: false,
};

/** Четыре уровня вложенности по одной строке: 0, 1, 2, 3. */
const DEPTHED_NODES: readonly ThreadLineNode[] = [0, 1, 2, 3].map((depth) =>
  nodeOf({ key: key('incoming', `d${depth}`), id: `d${depth}`, depth }),
);

// ─── Отрисовка ───

/**
 * Строка письма под перерисовкой: `at()` — текущая строка из разметки, `change`
 * правит названные реквизиты и оставляет остальные как есть.
 */
function letterRow(overrides: Partial<NodeProps> = {}) {
  let props: NodeProps = { ...NODE_DEFAULTS, ...overrides };
  const view = renderWithProviders(<MailThreadNode {...props} />);
  const change = (next: Partial<NodeProps> = {}) => {
    props = { ...props, ...next };
    view.rerender(<MailThreadNode {...props} />);
  };
  return { at: () => row(props.node.key), change };
}

/** Промежуток под перерисовкой — то же самое для зон сброса. */
function gapStrip(overrides: Partial<GapProps> = {}) {
  let props: GapProps = { ...GAP_DEFAULTS, ...overrides };
  const view = renderWithProviders(<MailThreadGap {...props} />);
  const change = (next: Partial<GapProps> = {}) => {
    props = { ...props, ...next };
    view.rerender(<MailThreadGap {...props} />);
  };
  return { at: () => gap(props.zoneId), change };
}

function renderNode(overrides: Partial<NodeProps> = {}) {
  return renderWithProviders(<MailThreadNode {...NODE_DEFAULTS} {...overrides} />);
}

function renderNodes(nodes: readonly ThreadLineNode[], overrides: Partial<NodeProps> = {}) {
  return renderWithProviders(
    <>
      {nodes.map((node) => (
        <MailThreadNode key={node.key} {...NODE_DEFAULTS} {...overrides} node={node} />
      ))}
    </>,
  );
}

// ─── Показатели строки ───

/** База `rem` в CSS: шаг вложенности Mantine переводит в `rem`, а не в пиксели. */
const REM_IN_PX = 16;

/**
 * Длина из встроенного стиля в пикселях. Шаг вложенности приходит в Mantine
 * числом (`pl={depth * MAIL_TREE_INDENT}`), а Mantine пишет его токеном
 * отступов, то есть `calc(Nrem * var(--mantine-scale))` — читать его надо
 * целиком, иначе глубина и отступ сравнивались бы в разных единицах.
 */
function toPx(value: string): number {
  const raw = value.trim();
  if (raw === '') return 0;
  const rem = /^calc\(([\d.]+)rem\b/.exec(raw) ?? /^([\d.]+)rem$/.exec(raw);
  if (rem) return Number.parseFloat(rem[1] ?? '0') * REM_IN_PX;
  const px = /^([\d.]+)px$/.exec(raw);
  if (px) return Number.parseFloat(px[1] ?? '0');
  throw new Error(`не разобрана длина: «${value}»`);
}

function row(nodeKey: string): HTMLElement {
  const found = document.querySelector(`[data-mail-node="${nodeKey}"]`);
  if (!found) throw new Error(`строки письма ${nodeKey} нет`);
  return found as HTMLElement;
}

function gap(zoneId: string): HTMLElement {
  const found = document.querySelector(`[data-mail-gap="${zoneId}"]`);
  if (!found) throw new Error(`зоны ${zoneId} нет`);
  return found as HTMLElement;
}

/**
 * Все части линии: вертикальная черта, ответвление к письму и засечка. Внутри
 * строки `position: absolute` есть только у них — поэтому способ не зависит ни
 * от порядка колонок, ни от того, узкий экран или широкий.
 */
function spineParts(element: HTMLElement): readonly HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>('*')].filter(
    (part) => part.style.position === 'absolute',
  );
}

/** Стили линии целиком: доказательство, что направление её не касается. */
function spineFingerprint(element: HTMLElement): string {
  return spineParts(element)
    .map((part) => part.getAttribute('style') ?? '')
    .join(' | ');
}

/** Отступ письма от линии в пикселях — то, чем читается вложенность. */
function letterIndentPx(element: HTMLElement): number {
  const box = element.querySelector('.mantine-Paper-root')?.parentElement;
  if (!box) throw new Error('у письма нет колонки под текст');
  return toPx(box.style.paddingLeft);
}

/** Длина ответвления линии к письму; у начала цепочки ответвления нет вовсе. */
function branchWidthPx(element: HTMLElement): number | null {
  const branch = spineParts(element).find((part) => part.style.height === '2px');
  return branch ? toPx(branch.style.width) : null;
}

/** Цвет вертикальной черты — им же красятся ответвление и засечка. */
function lineColor(element: HTMLElement): string {
  const line = spineParts(element).find((part) => part.style.top === '0px');
  return line?.style.backgroundColor ?? '';
}

/** Засечка в середине строки: второй носитель регистра на линии. */
function tickStyle(element: HTMLElement): string {
  const tick = spineParts(element).find((part) => part.style.borderRadius === '50%');
  return tick?.getAttribute('style') ?? '';
}

/** Сетка колонок строки: подписи, линия, письмо — либо только линия и письмо. */
function columns(element: HTMLElement): string {
  const grid = element.querySelector<HTMLElement>('[style*="grid-template-columns"]');
  return grid?.style.gridTemplateColumns ?? '';
}

/** Левая колонка подписей: дата и номер, а на узком экране её нет вовсе. */
function gutter(element: HTMLElement): HTMLElement {
  const grid = element.querySelector('[style*="grid-template-columns"]');
  const first = grid?.children[0];
  if (!first) throw new Error('у строки нет колонки подписей');
  return first as HTMLElement;
}

function paper(element: HTMLElement): HTMLElement {
  const found = element.querySelector<HTMLElement>('.mantine-Paper-root');
  if (!found) throw new Error('карточки письма нет');
  return found;
}

/**
 * Место под ручку перетаскивания: сама ручка или пустой блок той же ширины.
 * Оно первое в группе карточки и есть всегда — иначе письмо без права ездило бы
 * по линии влево-вправо вместе с выдачей прав.
 */
function handleSlot(element: HTMLElement): HTMLElement {
  const slot = paper(element).querySelector('.mantine-Group-root')?.firstElementChild;
  if (!slot) throw new Error('у письма нет места под ручку');
  return slot as HTMLElement;
}

function handleWidthPx(element: HTMLElement): number {
  return toPx(handleSlot(element).style.width);
}

/** Шапка письма: подпись направления рядом с иконкой, если она не прочерк. */
function headerText(element: HTMLElement): string {
  const texts = [...paper(element).querySelectorAll('p')].map((text) => text.textContent ?? '');
  return texts.find((text) => text !== '' && text !== MAIL_EMPTY_CELL) ?? '';
}

/** Имя иконки шапки: `tabler-icon tabler-icon-arrow-up-right`. */
function headerIcon(element: HTMLElement): string {
  const classes = paper(element).querySelector('svg')?.getAttribute('class') ?? '';
  return classes.trim().split(/\s+/).at(-1) ?? '';
}

/** Полоса-зона промежутка: рамка цели, в которую попадает подсказка. */
function band(element: HTMLElement): HTMLElement {
  const found = element.children[1];
  if (!found) throw new Error('у промежутка нет полосы-зоны');
  return found as HTMLElement;
}

/** Вертикальная черта, сквозь промежуток: ось времени не должна распадаться. */
function gapLine(element: HTMLElement): HTMLElement {
  const found = element.children[0];
  if (!found) throw new Error('у промежутка нет линии');
  return found as HTMLElement;
}

beforeEach(() => {
  dnd.draggable = [];
  dnd.droppable = [];
  dnd.draggingKey = null;
});

// ─── Глубина и вложенность ───

describe('MailThreadNode — глубина становится видимой', () => {
  it('отступ письма ровно на шаг вложенности за уровень, а у корня его нет', () => {
    renderNodes(DEPTHED_NODES);

    // Отступ — единственное, что отличает вложенное письмо от соседнего, и он
    // обязан быть ровно `depth * MAIL_TREE_INDENT`: на шаг больше письмо
    // «проваливается» вглубь, на шаг меньше — выглядит соседом своего предка.
    // И то и другое не падает, а молча собирает неверную переписку.
    const indents = DEPTHED_NODES.map((node) => letterIndentPx(row(node.key)));
    expect(indents).toEqual([0, MAIL_TREE_INDENT, 2 * MAIL_TREE_INDENT, 3 * MAIL_TREE_INDENT]);
    expect(indents.slice(1).map((indent, step) => indent - indents[step]!)).toEqual([
      MAIL_TREE_INDENT,
      MAIL_TREE_INDENT,
      MAIL_TREE_INDENT,
    ]);
  });

  it('ответвление линии длиннее на тот же шаг, а у начала цепочки его нет вовсе', () => {
    renderNodes(DEPTHED_NODES);

    // Ответвление рисуется только у вложенного письма и растёт вместе с
    // отступом — иначе глубина читалась бы по одному отступу текста, а линия,
    // по которой глаз идёт вертикально, показывала бы иную картину.
    expect(branchWidthPx(row(key('incoming', 'd0')))).toBeNull();
    const widths = DEPTHED_NODES.slice(1).map((node) => branchWidthPx(row(node.key)));
    expect(widths).toEqual([
      MAIL_TREE_INDENT + 13,
      2 * MAIL_TREE_INDENT + 13,
      3 * MAIL_TREE_INDENT + 13,
    ]);
    expect(widths[1]! - widths[0]!).toBe(MAIL_TREE_INDENT);
  });

  it('глубина — единственное, что двигает отступ: ни направление, ни права, ни якорь', () => {
    // Отступ обязан зависеть от `depth` и ни от чего больше. Иначе проверка
    // «отступ растёт с глубиной» прошла бы и при отступе, привязанном к
    // направлению шага, а человек читал бы у ответа «уровень вниз».
    const mail = letterRow({ node: nodeOf({ depth: 2 }) });
    const indent = letterIndentPx(mail.at());
    expect(indent).toBe(2 * MAIL_TREE_INDENT);

    for (const direction of ['anchor', 'up', 'down'] satisfies ThreadDirection[]) {
      mail.change({ direction });
      expect(letterIndentPx(mail.at())).toBe(indent);
    }
    mail.change({ canDrag: true, droppable: true });
    expect(letterIndentPx(mail.at())).toBe(indent);
    mail.change({ isAnchor: true });
    expect(letterIndentPx(mail.at())).toBe(indent);
    mail.change({ overState: 'bad', isCyclic: true });
    expect(letterIndentPx(mail.at())).toBe(indent);
    mail.change({ stacked: true });
    expect(letterIndentPx(mail.at())).toBe(indent);
  });

  it('засечка стоит в середине строки и не уезжает вместе с вложенностью', () => {
    renderNodes(DEPTHED_NODES);

    // Ответвление растёт, а засечка — маркер самого письма — остаётся на
    // середине черты при любой глубине, иначе вложенное письмо читалось бы как
    // засечённое ниже оси времени.
    for (const node of DEPTHED_NODES) {
      const tick = tickStyle(row(node.key));
      expect(tick).toContain('top: 50%');
      expect(tick).toContain('margin-top: -5.5px');
    }
  });
});

// ─── Права ───

describe('MailThreadNode — ворота прав', () => {
  it('без права двигать письмо ручки нет, а место под неё остаётся той же ширины', () => {
    renderNode({ canDrag: false });

    // Предлагать ручку тому, кому переставлять нельзя, — не «лишний элемент»,
    // а предложение сделать то, что сервер всё равно не запишет. При этом
    // письмо не должно уезжать влево: пустое место той же ширины держит
    // колонку у всех строк одинаковой.
    expect(screen.queryByRole('button', { name: /^Перетащить письмо/ })).not.toBeInTheDocument();
    expect(handleSlot(row(IN)).tagName).not.toBe('BUTTON');
    expect(handleWidthPx(row(IN))).toBe(32);
  });

  it('с правой двигать ручка есть, названа письмом и просит её схватить', () => {
    renderNode({ canDrag: true });

    const handle = screen.getByRole('button', { name: 'Перетащить письмо: ВХ-1' });
    expect(handle.style.cursor).toBe('grab');
    expect(handleWidthPx(row(IN))).toBe(32);
  });

  it('место под ручку одинаково при обоих правах — письмо не прыгает по колонке', () => {
    // Сравнение обязано идти по обеим ветвям `canDrag ? <ActionIcon/> : <Box/>`:
    // сузить ручку можно было бы незаметно, и письмо без права ездило бы по
    // линии влево-вправо вместе с выдачей прав.
    const mail = letterRow({ canDrag: false });
    const without = handleWidthPx(mail.at());

    mail.change({ canDrag: true });
    expect(handleWidthPx(mail.at())).toBe(without);
  });

  it('dnd-kit получает источник выключенным ровно тогда, когда права нет', () => {
    const mail = letterRow({ canDrag: false });
    expect(dnd.draggable).toEqual([{ id: IN, disabled: true }]);
    expect(dragSources()).toEqual([]);

    mail.change({ canDrag: true });
    expect(dnd.draggable).toContainEqual({ id: IN, disabled: false });
    expect(dragSources()).toContain(IN);
  });

  it('зона сброса на письмо регистрируется только пока что-то тянут', () => {
    const mail = letterRow({ droppable: false });
    expect(dnd.droppable).toEqual([{ id: mailNodeDropId(IN), disabled: true }]);
    expect(dropTargets()).toEqual([]);

    mail.change({ droppable: true });
    expect(dnd.droppable).toContainEqual({ id: mailNodeDropId(IN), disabled: false });
    expect(dropTargets()).toContain(mailNodeDropId(IN));
  });

  it('зона сброса письма не путается с зоной промежутка: у них разные идентификаторы', () => {
    // Оба идентификатора приходят в одну `DndContext` из одного списка узлов,
    // и разобрать их можно только по префиксу. Отдай строка свой ключ без
    // `node:` — и сброс на письмо молча превратился бы в «начать цепочку».
    renderNode({ droppable: true });

    expect(mailNodeDropId(IN)).not.toBe(IN);
    expect(mailNodeDropId(IN)).not.toBe(BEFORE_ZONE);
    expect(mailNodeDropId(IN)).not.toBe(HEAD_ZONE);
    expect(dropTargets()).toEqual([mailNodeDropId(IN)]);
  });

  it('право двигать и право быть целью — разные ворота: одно не закрывает другое', () => {
    // Человек вправе переставить чужое письмо к себе, но не вправе двигать
    // своё. Если бы второе право выводилось из первого, он потерял бы вход в
    // переписку; если бы первое — из второго, то же случилось бы с тем, кому
    // двигать своё можно.
    renderNode({ canDrag: false, droppable: true });

    expect(screen.queryByRole('button', { name: /^Перетащить письмо/ })).not.toBeInTheDocument();
    expect(dropTargets()).toEqual([mailNodeDropId(IN)]);
  });

  it('во время перетаскивания письмо едет за курсором и приподнимается над строкой', () => {
    const mail = letterRow({ canDrag: true });
    expect(paper(mail.at()).style.opacity).toBe('1');

    dnd.draggingKey = IN;
    mail.change();

    // Строка в линии остаётся на месте и работает зоной сброса, а едет ровно
    // та карточка, которую тянут: transform'ом, а не второй копией письма.
    const card = paper(mail.at());
    expect(card.style.transform).toContain('translate3d(40px, 60px, 0)');
    expect(card.style.opacity).toBe('0.6');
    expect(card.style.cursor).toBe('grabbing');
    expect(card.style.zIndex).toBe('2');
    expect(screen.getByRole('button', { name: /^Перетащить/ }).style.cursor).toBe('grabbing');
  });
});

// ─── Подпись письма ───

describe('MailThreadNode — подпись письма', () => {
  it('письма, которого нет в регистре, ручка не выдумывает: «письмо без подписей»', () => {
    // Связь осталась, а письма уже нет. Ручка остаётся — письмо по-прежнему
    // можно переставить, — но называть её нечем, и подпись обязана признать
    // это, а не сочинить номер.
    renderNode({ node: nodeOf({ letter: undefined }), canDrag: true });

    expect(
      screen.getByRole('button', { name: 'Перетащить письмо: письмо без подписей' }),
    ).toBeInTheDocument();
    expect(within(row(IN)).getByText(MISSING_LETTER_TEXT)).toBeInTheDocument();
  });

  it('подпись без номера берётся из темы, а без темы — честно признаёт отсутствие номера', () => {
    const mail = letterRow({ canDrag: true });
    const labelOf = () =>
      screen.getByRole('button', { name: /^Перетащить письмо: / }).getAttribute('aria-label');

    expect(labelOf()).toBe('Перетащить письмо: ВХ-1');
    mail.change({ node: nodeOf({ letter: letterOf({ number: '' }) }) });
    expect(labelOf()).toBe('Перетащить письмо: Тема письма');
    mail.change({ node: nodeOf({ letter: letterOf({ number: '', subject: '' }) }) });
    expect(labelOf()).toBe('Перетащить письмо: письмо без номера');
  });

  it('подпись ручки — это номер письма, а не тема и не контрагент', () => {
    // Номер опознаёт письмо в реестре, тема повторяется у десятков писем, а
    // контрагент — у всей переписки с одним человеком.
    renderNode({
      node: nodeOf({
        letter: letterOf({ number: 'ВХ-42', subject: 'Тема', counterparty: 'ООО «Ромашка»' }),
      }),
      canDrag: true,
    });

    expect(screen.getByRole('button', { name: 'Перетащить письмо: ВХ-42' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ромашка/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Тема/ })).not.toBeInTheDocument();
  });

  it('запасная подпись не становится обычным путём: у письма с номером она не нужна', () => {
    renderNode({ canDrag: true });

    expect(screen.getByRole('button', { name: 'Перетащить письмо: ВХ-1' })).toBeInTheDocument();
    expect(screen.queryByText('письмо без подписей')).not.toBeInTheDocument();
    expect(screen.queryByText('письмо без номера')).not.toBeInTheDocument();
    expect(screen.queryByText(MISSING_LETTER_TEXT)).not.toBeInTheDocument();
  });

  it('колонка подписей у удалённого письма честно пуста, а не выдумана', () => {
    renderNode({ node: nodeOf({ letter: undefined }) });

    // Дата и номер в колонке подписей — прочерк, а не догадка: выдуманная дата
    // встала бы на ту же ось времени и сдвинула бы соседей в переписке.
    const texts = [...gutter(row(IN)).querySelectorAll('p')].map((text) => text.textContent);
    expect(texts).toEqual([MAIL_EMPTY_CELL, MAIL_EMPTY_CELL]);
    expect(within(row(IN)).getByText(MISSING_LETTER_TEXT)).toBeInTheDocument();
  });
});

// ─── Направление ───

describe('MailThreadNode — направление шага', () => {
  it('каждое направление называет себя по-своему', () => {
    const mail = letterRow({ direction: 'anchor', node: nodeOf({ parentKey: IN }) });
    const headingOf = (direction: ThreadDirection) => {
      mail.change({ direction });
      return { label: headerText(mail.at()), icon: headerIcon(mail.at()) };
    };

    expect(headingOf('anchor')).toEqual({ label: 'текущее письмо', icon: 'tabler-icon-mail' });
    expect(headingOf('up')).toEqual({ label: 'ответ на', icon: 'tabler-icon-arrow-up-right' });
    expect(headingOf('down')).toEqual({ label: 'ответ', icon: 'tabler-icon-arrow-down-right' });
  });

  it('начало цепочки опознаётся по отсутствию родителя, а не по номеру строки', () => {
    // Второе начало стоит в середине списка, где «первое письмо» уже неверно:
    // угадывать начало по позиции значило бы назвать «ответ на» письмо, над
    // которым в линии ничего нет. Направление здесь — обязательная часть
    // условия, поэтому строка идёт вверх.
    renderNodes(
      [
        nodeOf({ key: key('incoming', 'a'), id: 'a', parentKey: null }),
        nodeOf({ key: key('incoming', 'b'), id: 'b', parentKey: key('incoming', 'a') }),
        nodeOf({ key: key('incoming', 'c'), id: 'c', parentKey: key('incoming', 'b') }),
        nodeOf({ key: key('incoming', 'd'), id: 'd', parentKey: null, depth: 1 }),
      ],
      { direction: 'up' },
    );

    expect(headerText(row(key('incoming', 'a')))).toBe('начало цепочки');
    expect(headerText(row(key('incoming', 'd')))).toBe('начало цепочки');
    expect(headerIcon(row(key('incoming', 'd')))).toBe('tabler-icon-arrow-bar-to-down');
    expect(headerText(row(key('incoming', 'b')))).toBe('ответ на');
  });

  it('снятое с переписки письмо стоит последним корнем, но шапка у него прежняя', () => {
    // Направление входит в условие обязательно: у такого письма родителя нет,
    // но в цепочку оно не входит, и назвать его началом значило бы пообещать
    // линию, которой нет.
    renderNode({ direction: 'down', node: nodeOf({ parentKey: null }) });

    expect(headerText(row(IN))).toBe('ответ');
    expect(headerIcon(row(IN))).toBe('tabler-icon-arrow-down-right');
    expect(screen.queryByText('начало цепочки')).not.toBeInTheDocument();
  });

  it('линия направления не различает: у ответа вверх и вниз она устроена одинаково', () => {
    // Время течёт вниз по левому краю, поэтому линия — одна непрерывная ось
    // без стрелок. Различать направление должна шапка; если бы различала линия,
    // ось перестала бы читаться как ось и шапка начала бы «прыгать».
    const mail = letterRow({ direction: 'anchor', node: nodeOf({ depth: 2 }) });
    const spine = spineFingerprint(mail.at());
    expect(spine).not.toBe('');

    mail.change({ direction: 'up' });
    expect(spineFingerprint(mail.at())).toBe(spine);
    mail.change({ direction: 'down' });
    expect(spineFingerprint(mail.at())).toBe(spine);
  });
});

// ─── Состояние цели ───

describe('MailThreadNode — состояние цели', () => {
  it('линия и карточка отвечают на сброс: спокойная, принятие, отказ', () => {
    const mail = letterRow({ overState: 'none' });
    const stateOf = (overState: ThreadOverState) => {
      mail.change({ overState });
      return { line: lineColor(mail.at()), shadow: paper(mail.at()).style.boxShadow };
    };

    expect(stateOf('none').line).toBe('var(--mantine-color-gray-4)');
    expect(stateOf('ok').line).toBe('var(--mantine-color-blue-6)');
    expect(stateOf('bad').line).toBe('var(--mantine-color-red-6)');

    // Подсветка цели — тенью внутрь, а не толщиной рамки: толщина сдвинула бы
    // строку на пиксель ровно в момент отпускания письма.
    expect(stateOf('ok').shadow).toBe('inset 0 0 0 2px var(--mantine-color-blue-6)');
    expect(stateOf('bad').shadow).toBe('inset 0 0 0 2px var(--mantine-color-red-6)');
    expect(stateOf('none').shadow).toBe('');
  });

  it('открытое письмо отличается от прочих и по линии, и по подложке', () => {
    const mail = letterRow();
    expect(lineColor(mail.at())).toBe('var(--mantine-color-gray-4)');
    expect(paper(mail.at()).style.background).toBe('');

    // Якорь — то письмо, ради которого переписку и открыли: линия под ним
    // спокойно подсвечена, а карточка лежит на голубой подложке.
    mail.change({ isAnchor: true });
    expect(lineColor(mail.at())).toBe('var(--mantine-color-blue-5)');
    expect(paper(mail.at()).style.background).toBe('var(--mantine-color-blue-0)');
    expect(paper(mail.at()).style.boxShadow).toContain('var(--mantine-shadow-sm)');
  });

  it('засечка повторяет цвет своего регистра, а у якоря — цвет линии', () => {
    // Взгляд по вертикали читает чередование сторон, поэтому цвет засечки —
    // второй носитель регистра после бейджа, и он обязан быть тем же.
    const mail = letterRow({ node: nodeOf({ type: 'incoming' }) });
    const tickOf = (type: 'incoming' | 'outgoing', isAnchor: boolean) => {
      mail.change({ node: nodeOf({ type }), isAnchor });
      return tickStyle(mail.at());
    };

    expect(tickOf('incoming', false)).toContain('background-color: var(--mantine-color-blue-6)');
    expect(tickOf('outgoing', false)).toContain('background-color: var(--mantine-color-orange-6)');
    expect(tickOf('incoming', true)).toContain('background-color: var(--mantine-color-blue-5)');
    expect(tickOf('incoming', true)).toContain('border: 2px solid var(--mantine-color-blue-0)');
  });

  it('о кольце говорит только то письмо, которое в кольце', () => {
    const mail = letterRow({ isCyclic: true });
    expect(within(mail.at()).getByText('кольцо')).toBeInTheDocument();

    mail.change({ isCyclic: false });
    expect(within(mail.at()).queryByText('кольцо')).not.toBeInTheDocument();
  });
});

// ─── Узкий экран ───

describe('MailThreadNode — узкий экран', () => {
  it('колонка подписей уходит, линия встаёт к краю, а дата переезжает в письмо', () => {
    renderNode({ stacked: true });

    // Три колонки на широком экране на узком не помещаются: дата и номер
    // встают над письмом, линия остаётся слева — иначе ось времени съехала бы
    // под обрезанную колонку подписей.
    expect(columns(row(IN))).toBe('26px minmax(0, 1fr)');
    expect(within(row(IN)).getByText('10.01.2026 · ВХ-1')).toBeInTheDocument();
  });

  it('на широком экране та же дата стоит в своей колонке и в письмо не дублируется', () => {
    renderNode();

    expect(columns(row(IN))).toBe('96px 26px minmax(0, 1fr)');
    expect(within(row(IN)).getByText('ВХ-1')).toHaveAttribute('title', 'ВХ-1');
    expect(within(row(IN)).queryByText('10.01.2026 · ВХ-1')).not.toBeInTheDocument();
  });
});

// ─── Переход в реестр ───

describe('MailThreadNode — переход в реестр', () => {
  it('иконка поиска уходит с идентификатором, регистром и датой письма', async () => {
    const user = userEvent.setup();
    const onGoToRegister = vi.fn();
    renderNode({ onGoToRegister });

    await user.click(screen.getByRole('button', { name: 'Перейти к письму в реестре: ВХ-1' }));

    expect(onGoToRegister).toHaveBeenCalledWith('a', 'incoming', '2026-01-10');
  });

  it('без обработчика перехода иконки нет, а у удалённого письма её не бывает вовсе', () => {
    const mail = letterRow();
    expect(screen.queryByRole('button', { name: /^Перейти к письму/ })).not.toBeInTheDocument();

    // Письма нет — искать в реестре нечего: иконка, ведущая «туда же», была бы
    // обещанием открыть то, чего уже не существует.
    mail.change({ node: nodeOf({ letter: undefined }), onGoToRegister: vi.fn() });
    expect(screen.queryByRole('button', { name: /^Перейти к письму/ })).not.toBeInTheDocument();
  });

  it('поиск не зависит от права двигать: он не переупорядочивает', () => {
    renderNode({ canDrag: false, onGoToRegister: vi.fn() });

    expect(
      screen.getByRole('button', { name: 'Перейти к письму в реестре: ВХ-1' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Перетащить письмо/ })).not.toBeInTheDocument();
  });
});

// ─── Промежуток между соседями ───

describe('MailThreadGap — промежуток между соседями', () => {
  it('подсказка видна только под курсором, а в покое полоса пустая и прозрачная', () => {
    const strip = gapStrip({ overState: 'none' });
    expect(screen.queryByText(MAIL_DROP_HINT_HEAD)).not.toBeInTheDocument();
    expect(band(strip.at()).style.borderColor).toBe('transparent');
    expect(band(strip.at()).style.backgroundColor).toBe('transparent');
    expect(band(strip.at()).style.cursor).toBe('');

    // Полоса остаётся на месте и без рамки: иначе зоны не существовало бы между
    // плотно стоящими строками — а именно там её и ищут.
    expect(band(strip.at()).getAttribute('style')).toContain('inset: 3px 0');

    strip.change({ overState: 'ok' });
    expect(screen.getByText(MAIL_DROP_HINT_HEAD)).toBeInTheDocument();
  });

  it('принятие красится синим, отказ — красным и запрещает курсор', () => {
    const strip = gapStrip({ overState: 'ok' });
    const ok = band(strip.at());
    expect(ok.style.borderColor).toBe('var(--mantine-color-blue-5)');
    expect(ok.style.backgroundColor).toBe('var(--mantine-color-blue-0)');
    expect(ok.style.cursor).toBe('');

    // Отказ обязан быть виден до отпускания: иначе «письмо не встало» читалось
    // бы как потеря связи, а не как запрет.
    strip.change({ zoneId: TAIL_ZONE, overState: 'bad' });
    const bad = band(strip.at());
    expect(bad.style.borderColor).toBe('var(--mantine-color-red-5)');
    expect(bad.style.backgroundColor).toBe('var(--mantine-color-blue-0)');
    expect(bad.style.cursor).toBe('not-allowed');
  });

  it('линия сквозь промежуток не гаснет вместе с подсветкой зоны', () => {
    const strip = gapStrip({ zoneId: BEFORE_ZONE, overState: 'none' });

    // Ось времени не должна распадаться на отрезки между полосами: линия
    // промежутка всегда серая и всегда на месте, независимо от цели.
    for (const overState of ['ok', 'bad'] satisfies readonly ThreadOverState[]) {
      strip.change({ overState });
      const line = gapLine(strip.at());
      expect(line.style.backgroundColor).toBe('var(--mantine-color-gray-4)');
      expect(line.style.width).toBe('2px');
      expect(line.style.top).toBe('0px');
      expect(line.style.bottom).toBe('0px');
    }
  });

  it('на узком экране линия уходит к краю, на широком — встаёт под колонкой подписей', () => {
    const strip = gapStrip({ stacked: false });
    expect(gapLine(strip.at()).style.left).toBe('108px');

    // Без колонки подписей линия сдвигается к краю, иначе ось повисла бы там,
    // где на широком экране стояли даты.
    strip.change({ stacked: true });
    expect(gapLine(strip.at()).style.left).toBe('12px');
  });

  it('зона промежутка не становится целью, пока письмо не тянут', () => {
    const strip = gapStrip({ zoneId: BEFORE_ZONE, droppable: false });
    expect(dnd.droppable).toEqual([{ id: BEFORE_ZONE, disabled: true }]);
    expect(dropTargets()).toEqual([]);

    strip.change({ droppable: true });
    expect(dropTargets()).toEqual([BEFORE_ZONE]);
  });

  it('подсказка промежутка отличается от подсказки края: они обещают разное', () => {
    // «Ответ рядом с соседом» и «Первым — и своя цепочка» — разные обещания, и
    // перепутать их значило бы сбросить письмо не туда, куда человек вёл.
    gapStrip({ zoneId: BEFORE_ZONE, hint: MAIL_DROP_HINT_BEFORE, overState: 'ok' });

    expect(screen.getByText(MAIL_DROP_HINT_BEFORE)).toBeInTheDocument();
    expect(screen.queryByText(MAIL_DROP_HINT_HEAD)).not.toBeInTheDocument();
    expect(MAIL_DROP_HINT_BEFORE).not.toBe(MAIL_DROP_HINT_HEAD);
  });
});
