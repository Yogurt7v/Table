import { describe, expect, it } from 'vitest';
import type { IIncomingMail, IMailRelation, IOutgoingMail } from '@/shared/types';
import {
  buildLetterIndex,
  buildMailThread,
  buildMailThreadGraph,
  mailEdgeEnd,
  mailNodeKey,
  resolveRelationEdge,
  THREAD_MAX_DEPTH,
  type MailLetterIndex,
} from './mail-thread';

/**
 * Связи в `mail_relations` — это четыре необязательных поля, и заполнены ровно
 * два: по одному на сторону. Тесты ниже держат два инварианта, из-за которых
 * дерево вообще возможно:
 *
 *  1. **Стороны разбираются независимо.** `relationEndpoints` (`mail-relations.ts`)
 *     читает только пару полей выбранного регистра, поэтому связь
 *     «исходящий → входящий» для входящей стороны не видна. Здесь она обязана
 *     давать ребро, а с незаполненной стороной — не давать ничего.
 *  2. **Обход не зацикливается.** Связи пишутся без защиты от циклов, поэтому
 *     цикл, ромб и ветка длиннее предела обязаны заканчиваться, а не уводить
 *     рекурсию в бесконечность.
 */

const ORG_ID = 'org0000000000001';

function relation(partial: Partial<IMailRelation>): IMailRelation {
  return { id: 'rel0000000000001', organization_id: ORG_ID, ...partial };
}

function incomingLink(id: string, parentId: string, childId: string): IMailRelation {
  return relation({
    id,
    parent_incoming_mail_id: parentId,
    child_incoming_mail_id: childId,
  });
}

function outgoingLink(id: string, parentId: string, childId: string): IMailRelation {
  return relation({
    id,
    parent_outgoing_mail_id: parentId,
    child_outgoing_mail_id: childId,
  });
}

function incomingMail(id: string, over: Partial<IIncomingMail> = {}): IIncomingMail {
  return {
    id,
    organization_id: ORG_ID,
    date: '2026-01-15',
    subject: `Тема ${id}`,
    sender: `ООО «${id}»`,
    responsible: 'user1',
    ...over,
  };
}

function outgoingMail(id: string, over: Partial<IOutgoingMail> = {}): IOutgoingMail {
  return {
    id,
    organization_id: ORG_ID,
    date: '2026-01-16',
    subject: `Тема ${id}`,
    recipient: `ООО «${id}»`,
    responsible: 'user1',
    outgoing_number: `И-${id}`,
    ...over,
  };
}

function letterIndex(over: { incoming?: IIncomingMail[]; outgoing?: IOutgoingMail[] } = {}) {
  return buildLetterIndex(over.incoming ?? [], over.outgoing ?? []);
}

/** Ключи узлов дерева — то, что действительно показывает экран. */
function keys(nodes: readonly { key: string }[]): string[] {
  return nodes.map((node) => node.key);
}

describe('mailNodeKey', () => {
  it('включает регистр в ключ, поэтому id из разных коллекций не сливаются', () => {
    expect(mailNodeKey('incoming', 'av97cwn9zwc7gck')).toBe('incoming:av97cwn9zwc7gck');
    expect(mailNodeKey('outgoing', 'av97cwn9zwc7gck')).toBe('outgoing:av97cwn9zwc7gck');
    expect(mailNodeKey('incoming', 'av97cwn9zwc7gck')).not.toBe(
      mailNodeKey('outgoing', 'av97cwn9zwc7gck'),
    );
  });
});

describe('resolveRelationEdge', () => {
  it('разбирает связь входящий → входящий', () => {
    const edge = resolveRelationEdge(
      relation({ parent_incoming_mail_id: 'a', child_incoming_mail_id: 'b' }),
    );
    expect(edge?.parent).toEqual({ key: 'incoming:a', type: 'incoming', id: 'a' });
    expect(edge?.child).toEqual({ key: 'incoming:b', type: 'incoming', id: 'b' });
  });

  it('разбирает связь исходящий → исходящий', () => {
    const edge = resolveRelationEdge(
      relation({ parent_outgoing_mail_id: 'a', child_outgoing_mail_id: 'b' }),
    );
    expect(edge?.parent).toEqual({ key: 'outgoing:a', type: 'outgoing', id: 'a' });
    expect(edge?.child).toEqual({ key: 'outgoing:b', type: 'outgoing', id: 'b' });
  });

  it('разбирает межрегистровую связь входящий → исходящий', () => {
    const edge = resolveRelationEdge(
      relation({ parent_incoming_mail_id: 'a', child_outgoing_mail_id: 'b' }),
    );
    expect(edge?.parent).toEqual({ key: 'incoming:a', type: 'incoming', id: 'a' });
    expect(edge?.child).toEqual({ key: 'outgoing:b', type: 'outgoing', id: 'b' });
  });

  it('разбирает межрегистровую связь исходящий → входящий, невидимую для relationEndpoints', () => {
    const edge = resolveRelationEdge(
      relation({ parent_outgoing_mail_id: 'a', child_incoming_mail_id: 'b' }),
    );
    expect(edge?.parent).toEqual({ key: 'outgoing:a', type: 'outgoing', id: 'a' });
    expect(edge?.child).toEqual({ key: 'incoming:b', type: 'incoming', id: 'b' });
  });

  it('пропускает строку без родителя, а не делает узел с пустым id', () => {
    const edge = resolveRelationEdge(relation({ child_incoming_mail_id: 'b' }));
    expect(edge).toBeNull();
  });

  it('пропускает строку без ребёнка', () => {
    const edge = resolveRelationEdge(relation({ parent_incoming_mail_id: 'a' }));
    expect(edge).toBeNull();
  });

  it('берёт входящий регистр, если заполнены оба поля стороны', () => {
    const edge = resolveRelationEdge(
      relation({ parent_incoming_mail_id: 'a', parent_outgoing_mail_id: 'z' }),
    );
    expect(edge).toBeNull();

    const withChild = resolveRelationEdge(
      relation({
        parent_incoming_mail_id: 'a',
        parent_outgoing_mail_id: 'z',
        child_outgoing_mail_id: 'b',
      }),
    );
    expect(withChild?.parent.key).toBe('incoming:a');
  });
});

describe('buildMailThreadGraph', () => {
  it('не тянет в граф письмо, о котором не знает ни одна связь', () => {
    const letters = letterIndex({
      incoming: [incomingMail('a'), incomingMail('b'), incomingMail('unrelated')],
    });
    const graph = buildMailThreadGraph([incomingLink('r1', 'a', 'b')], letters);

    expect([...graph.down.keys()]).toEqual(['incoming:a']);
    expect([...graph.up.keys()]).toEqual(['incoming:b']);
    expect(graph.up.get('incoming:a')).toBeUndefined();
  });

  it('ведёт обе стороны межрегистровой связи', () => {
    const graph = buildMailThreadGraph([
      relation({ parent_outgoing_mail_id: 'a', child_incoming_mail_id: 'b' }),
    ]);

    expect(keys(graph.down.get('outgoing:a') ?? [])).toEqual(['incoming:b']);
    expect(keys(graph.up.get('incoming:b') ?? [])).toEqual(['outgoing:a']);
  });

  it('схлопывает повторную строку связи в одно ребро', () => {
    const graph = buildMailThreadGraph([
      incomingLink('r1', 'a', 'b'),
      incomingLink('r2', 'a', 'b'),
    ]);

    expect(graph.down.get('incoming:a')).toHaveLength(1);
  });

  it('выкидывает строки с незаполненной стороной, не оставляя пустых концов', () => {
    const graph = buildMailThreadGraph([
      relation({ id: 'r1', child_incoming_mail_id: 'b' }),
      relation({ id: 'r2', parent_incoming_mail_id: 'a' }),
    ]);

    expect([...graph.down.keys()]).toEqual([]);
    expect([...graph.up.keys()]).toEqual([]);
  });
});

describe('buildLetterIndex', () => {
  it('раскладывает письмо по ключу с регистром и достаёт номер и контрагента', () => {
    const index = letterIndex({
      incoming: [incomingMail('a', { number: 'В-12' })],
      outgoing: [outgoingMail('a', { outgoing_number: 'И-34' })],
    });

    expect(index.get('incoming:a')?.number).toBe('В-12');
    expect(index.get('incoming:a')?.counterparty).toBe('ООО «a»');
    expect(index.get('outgoing:a')?.number).toBe('И-34');
    expect(index.get('outgoing:a')?.counterparty).toBe('ООО «a»');
  });

  it('разводит одноимённые id входящего и исходящего по разным ключам', () => {
    const index = letterIndex({
      incoming: [incomingMail('same')],
      outgoing: [outgoingMail('same')],
    });

    expect(index.size).toBe(2);
    expect(index.get('incoming:same')?.key).toBe('incoming:same');
    expect(index.get('outgoing:same')?.key).toBe('outgoing:same');
  });
});

describe('buildMailThread — вверх', () => {
  // a → b → c, корень — b
  const graph = buildMailThreadGraph([incomingLink('r1', 'a', 'b'), incomingLink('r2', 'b', 'c')]);

  it('собирает предков среднего письма цепочки от ближайшего к дальнему', () => {
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'b'));

    expect(keys(thread.ancestors)).toEqual(['incoming:a']);
    expect(keys(thread.descendants)).toEqual(['incoming:c']);
  });

  it('проставляет глубину относительно корня и помечает корень', () => {
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'b'));

    expect(thread.root).toEqual({
      key: 'incoming:b',
      type: 'incoming',
      id: 'b',
      depth: 0,
      isRoot: true,
    });
    expect(thread.descendants.map((node) => node.depth)).toEqual([1]);
    expect(thread.descendants.map((node) => node.isRoot)).toEqual([false]);
  });

  it('поднимается вверх транзитивно, а не на один шаг', () => {
    const deep = buildMailThreadGraph([
      incomingLink('r1', 'a', 'b'),
      incomingLink('r2', 'b', 'c'),
      incomingLink('r3', 'c', 'd'),
    ]);
    const thread = buildMailThread(deep, mailEdgeEnd('incoming', 'd'));

    expect(keys(thread.ancestors)).toEqual(['incoming:c', 'incoming:b', 'incoming:a']);
    expect(thread.ancestors.map((node) => node.depth)).toEqual([1, 2, 3]);
  });
});

describe('buildMailThread — вниз', () => {
  it('разворачивает ветку в глубину, а не в один шаг', () => {
    const graph = buildMailThreadGraph([
      outgoingLink('r1', 'a', 'b'),
      outgoingLink('r2', 'b', 'c'),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('outgoing', 'a'));

    expect(keys(thread.descendants)).toEqual(['outgoing:b', 'outgoing:c']);
    expect(thread.descendants.map((node) => node.depth)).toEqual([1, 2]);
    expect(thread.ancestors).toEqual([]);
  });

  it('показывает межрегистровую ветку вниз целиком', () => {
    const graph = buildMailThreadGraph([
      relation({ parent_incoming_mail_id: 'a', child_outgoing_mail_id: 'b' }),
      relation({ parent_outgoing_mail_id: 'b', child_incoming_mail_id: 'c' }),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'a'));

    expect(keys(thread.descendants)).toEqual(['outgoing:b', 'incoming:c']);
    expect(thread.descendants.map((node) => node.type)).toEqual(['outgoing', 'incoming']);
  });

  it('разводит две ветки от одного письма', () => {
    const graph = buildMailThreadGraph([
      incomingLink('r1', 'a', 'b'),
      incomingLink('r2', 'a', 'c'),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'a'));

    expect(keys(thread.descendants)).toEqual(['incoming:b', 'incoming:c']);
    expect(thread.descendants.map((node) => node.depth)).toEqual([1, 1]);
  });
});

describe('buildMailThread — слияние ветвей', () => {
  it('показывает письмо с двумя родителями в обоих предках', () => {
    const graph = buildMailThreadGraph([
      incomingLink('r1', 'x', 'root'),
      incomingLink('r2', 'y', 'root'),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'root'));

    expect(keys(thread.ancestors)).toEqual(['incoming:x', 'incoming:y']);
    expect(thread.descendants).toEqual([]);
    expect(thread.skipped).toBe(0);
  });

  it('разводит две исходящие ветви от одного входящего письма', () => {
    const graph = buildMailThreadGraph([
      relation({ parent_incoming_mail_id: 'a', child_outgoing_mail_id: 'b' }),
      relation({ parent_incoming_mail_id: 'a', child_outgoing_mail_id: 'c' }),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'a'));

    expect(keys(thread.descendants)).toEqual(['outgoing:b', 'outgoing:c']);
  });
});

describe('buildMailThread — циклы и ромбы', () => {
  it('заканчивается на цикле A → B → A, не показывая A второй раз', () => {
    const graph = buildMailThreadGraph([
      incomingLink('r1', 'a', 'b'),
      incomingLink('r2', 'b', 'a'),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'a'));

    // B — сосед A в обоих направлениях, и в цикле это правда; A повторно не
    // выводится ни в одной из веток.
    expect(keys(thread.ancestors)).toEqual(['incoming:b']);
    expect(keys(thread.descendants)).toEqual(['incoming:b']);
    expect(thread.descendants.some((node) => node.key === 'incoming:a')).toBe(false);
    expect(thread.skipped).toBe(2);
  });

  it('заканчивается на длинном цикле A → B → C → A', () => {
    const graph = buildMailThreadGraph([
      incomingLink('r1', 'a', 'b'),
      incomingLink('r2', 'b', 'c'),
      incomingLink('r3', 'c', 'a'),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'a'));

    expect(keys(thread.ancestors)).toEqual(['incoming:c', 'incoming:b']);
    expect(keys(thread.descendants)).toEqual(['incoming:b', 'incoming:c']);
    expect(thread.skipped).toBe(2);
  });

  it('не выводит корень в предках, хотя цикл проходит через него вверх', () => {
    const graph = buildMailThreadGraph([
      incomingLink('r1', 'b', 'a'),
      incomingLink('r2', 'a', 'b'),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'a'));

    expect(keys(thread.ancestors)).toEqual(['incoming:b']);
    expect(thread.ancestors.some((node) => node.key === 'incoming:a')).toBe(false);
    expect(thread.ancestors.map((node) => node.depth)).toEqual([1]);
  });

  it('не показывает ромб дважды: письно приходит по первому пути, второй сходится', () => {
    const graph = buildMailThreadGraph([
      incomingLink('r1', 'a', 'b'),
      incomingLink('r2', 'a', 'c'),
      incomingLink('r3', 'b', 'd'),
      incomingLink('r4', 'c', 'd'),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'a'));

    expect(keys(thread.descendants)).toEqual(['incoming:b', 'incoming:d', 'incoming:c']);
    expect(thread.descendants.filter((node) => node.key === 'incoming:d')).toHaveLength(1);
    expect(thread.skipped).toBe(1);
  });
});

describe('buildMailThread — предел глубины', () => {
  it('не уходит глубже именованного предела и считает отброшенное', () => {
    const chain = Array.from({ length: THREAD_MAX_DEPTH + 8 }, (_unused, index) =>
      incomingLink(`r${index}`, `mail${index}`, `mail${index + 1}`),
    );
    const graph = buildMailThreadGraph(chain);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'mail0'));

    expect(thread.descendants).toHaveLength(THREAD_MAX_DEPTH);
    expect(Math.max(...thread.descendants.map((node) => node.depth))).toBe(THREAD_MAX_DEPTH);
    expect(keys(thread.descendants)).toContain(`incoming:mail${THREAD_MAX_DEPTH}`);
    expect(keys(thread.descendants)).not.toContain(`incoming:mail${THREAD_MAX_DEPTH + 1}`);
    // Отброшен только первый узел за пределом: дальше обход не идёт вовсе,
    // а не перечисляет весь хвост цепочки.
    expect(thread.skipped).toBe(1);
  });

  it('применяет предел и к ветке вверх', () => {
    const chain = Array.from({ length: THREAD_MAX_DEPTH + 3 }, (_unused, index) =>
      incomingLink(`r${index}`, `mail${index + 1}`, `mail${index}`),
    );
    const graph = buildMailThreadGraph(chain);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'mail0'));

    expect(thread.ancestors).toHaveLength(THREAD_MAX_DEPTH);
    expect(Math.max(...thread.ancestors.map((node) => node.depth))).toBe(THREAD_MAX_DEPTH);
    expect(keys(thread.ancestors)).not.toContain(`incoming:mail${THREAD_MAX_DEPTH + 1}`);
    expect(thread.descendants).toEqual([]);
    expect(thread.skipped).toBe(1);
  });
});

describe('buildMailThread — порядок соседей', () => {
  const lettersFor: MailLetterIndex = letterIndex({
    incoming: [
      incomingMail('d', { date: '2026-03-01', seq: 4 }),
      incomingMail('c', { date: '2026-01-01', seq: 9 }),
      incomingMail('b', { date: '2026-02-01', seq: 2 }),
      incomingMail('a', { date: '2026-02-01', seq: 7 }),
    ],
  });

  it('упорядочивает соседей по дате письма', () => {
    const graph = buildMailThreadGraph(
      [
        incomingLink('r1', 'root', 'd'),
        incomingLink('r2', 'root', 'c'),
        incomingLink('r3', 'root', 'b'),
      ],
      lettersFor,
    );
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'root'));

    expect(keys(thread.descendants)).toEqual(['incoming:c', 'incoming:b', 'incoming:d']);
  });

  it('при равной дате упорядочивает соседей по порядковому номеру', () => {
    const graph = buildMailThreadGraph(
      [incomingLink('r1', 'root', 'a'), incomingLink('r2', 'root', 'b')],
      lettersFor,
    );
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'root'));

    expect(keys(thread.descendants)).toEqual(['incoming:b', 'incoming:a']);
  });

  it('при равных дате и номере упорядочивает соседей по ключу, а не по порядку строк', () => {
    const tie = letterIndex({
      incoming: [
        incomingMail('second', { date: '2026-05-05', seq: 5 }),
        incomingMail('first', { date: '2026-05-05', seq: 5 }),
      ],
    });
    const forward = buildMailThreadGraph(
      [incomingLink('r1', 'root', 'second'), incomingLink('r2', 'root', 'first')],
      tie,
    );
    const backward = buildMailThreadGraph(
      [incomingLink('r1', 'root', 'first'), incomingLink('r2', 'root', 'second')],
      tie,
    );

    const expected = ['incoming:first', 'incoming:second'];
    expect(keys(buildMailThread(forward, mailEdgeEnd('incoming', 'root')).descendants)).toEqual(
      expected,
    );
    expect(keys(buildMailThread(backward, mailEdgeEnd('incoming', 'root')).descendants)).toEqual(
      expected,
    );
  });

  it('уводит письмо без даты в конец, а не в начало списка', () => {
    const mixed = letterIndex({
      incoming: [
        incomingMail('undated', { date: '' }),
        incomingMail('dated', { date: '2026-04-04' }),
      ],
    });
    const graph = buildMailThreadGraph(
      [incomingLink('r1', 'root', 'undated'), incomingLink('r2', 'root', 'dated')],
      mixed,
    );
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'root'));

    expect(keys(thread.descendants)).toEqual(['incoming:dated', 'incoming:undated']);
  });

  it('не теряет соседей, которых нет в индексе писем: порядок падает на ключ', () => {
    const graph = buildMailThreadGraph([
      incomingLink('r1', 'root', 'zz'),
      incomingLink('r2', 'root', 'aa'),
    ]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'root'));

    expect(keys(thread.descendants)).toEqual(['incoming:aa', 'incoming:zz']);
  });
});

describe('buildMailThread — корень без связей', () => {
  it('возвращает только корень, если вокруг него нет связей', () => {
    const graph = buildMailThreadGraph([incomingLink('r1', 'a', 'b')]);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'lonely'));

    expect(thread.ancestors).toEqual([]);
    expect(thread.descendants).toEqual([]);
    expect(thread.skipped).toBe(0);
    expect(thread.root.isRoot).toBe(true);
  });

  it('не выводит постороннее письмо организации, даже если оно есть в индексе писем', () => {
    const letters = letterIndex({
      incoming: [incomingMail('a'), incomingMail('b'), incomingMail('other')],
    });
    const graph = buildMailThreadGraph([incomingLink('r1', 'a', 'b')], letters);
    const thread = buildMailThread(graph, mailEdgeEnd('incoming', 'a'));

    expect(letters.has('incoming:other')).toBe(true);
    expect(keys(thread.descendants)).toEqual(['incoming:b']);
    expect(keys(thread.ancestors)).toEqual([]);
  });
});
