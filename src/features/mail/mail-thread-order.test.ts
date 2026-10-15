import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  applyOrderPlacement,
  MAIL_THREAD_ORDER_KEY,
  mailThreadOrderRanks,
  parseMailThreadOrder,
  useMailThreadOrder,
} from './mail-thread-order';
import type { MailThreadOrder } from './mail-thread-order';
import type { MailOrderPlacement } from './mail-thread-builder';
import type { MailNodeKey } from './mail-thread';

/**
 * Порядок соседей в линии переписки. Три чистые функции и один хук, а ошибка
 * здесь стоит дорого: иерархия писем живёт в `mail_relations` и восстанавливается
 * сама, а вот место соседа друг относительно друга — нет, и по датам оно не
 * выводится (две переписки одного дня с одной датой дали бы два разных порядка
 * при одних и тех же связях). Это решение человека, и оно хранится в настройке.
 *
 * Значит проверять надо не «как отсортировано», а три обещания, на которых держится
 * иначе вся переписка:
 *
 *  1. **Группа — это родитель, а не переписка.** Письмо, снятое с одного родителя,
 *     не должно оставлять в его группе старого места: общий на всех список вёл бы
 *     к тому, что переставленное письмо встало бы первым в любой другой ветке.
 *  2. **Группа пишется целиком.** Сохранённый порядок хранит намерение человека,
 *     а не разницу с прошлым состоянием, поэтому запись нового места переписывает
 *     всю группу — иначе сосед, впервые попавший в настройку, прыгал бы вниз.
 *  3. **Индекс приходит из `siblings`, который включает и само письмо.** Отсюда
 *     сдвиг на единицу: «поставить перед соседом» не должно двигать письмо, уже
 *     стоящее перед ним.
 *
 * Плюс граница доверия: значение из настройки приходит как `unknown` и разбирается
 * на месте, поэтому кривое значение обязано давать пустой порядок, а не исключение
 * посреди отрисовки модалки.
 */

/** Ключи писем в тестах собираются строкой — как их собирает `mailNodeKey`. */
const key = (id: string): MailNodeKey => `incoming:${id}`;

type OrderGroup = Readonly<Record<string, readonly MailNodeKey[]>>;

/** Настройка сразу из нескольких групп: читается как сама настройка в базе. */
const order = (...groups: readonly OrderGroup[]): MailThreadOrder => Object.assign({}, ...groups);

/**
 * Настройка подменяется целиком: обе половины хука обязаны читать и писать одну и
 * ту же строку, иначе чтение и запись разойдутся по разным записям молча.
 */
const hooks = vi.hoisted(() => {
  const state = { setting: undefined as unknown };
  const mutate = vi.fn();
  return {
    state,
    mutate,
    useUserSetting: vi.fn(() => ({ data: state.setting })),
    useUpsertUserSetting: vi.fn(() => ({ mutate })),
  };
});

vi.mock('@/shared/hooks/useUserSettings', () => ({
  useUserSetting: hooks.useUserSetting,
  useUpsertUserSetting: hooks.useUpsertUserSetting,
}));

beforeEach(() => {
  hooks.state.setting = undefined;
  hooks.mutate.mockClear();
  hooks.useUserSetting.mockClear();
  hooks.useUpsertUserSetting.mockClear();
});

describe('parseMailThreadOrder: разбор значения из настройки', () => {
  it('значение не-объект даёт пустой порядок, а не исключение', () => {
    expect(parseMailThreadOrder(undefined)).toEqual({});
    expect(parseMailThreadOrder(null)).toEqual({});
    expect(parseMailThreadOrder('incoming:a')).toEqual({});
    expect(parseMailThreadOrder(42)).toEqual({});
    expect(parseMailThreadOrder(true)).toEqual({});
  });

  it('массив — не объект порядка: у него нет групп', () => {
    expect(parseMailThreadOrder([])).toEqual({});
    expect(parseMailThreadOrder([{ 'incoming:p': ['incoming:a'] }])).toEqual({});
  });

  it('группа без массива пропускается, а соседние группы остаются', () => {
    expect(
      parseMailThreadOrder({ 'incoming:p': 'incoming:a', 'incoming:q': ['incoming:b'] }),
    ).toEqual({ 'incoming:q': ['incoming:b'] });
  });

  it('группа, из которой не осталось ни одного ключа, не появляется вовсе', () => {
    // Ключ с пустым массивом и ключ с одним мусорным элементом неразличимы
    // результатом: оба означают «порядка здесь нет», и лишний ключ в разборе
    // зря занимал бы место в настройке.
    expect(parseMailThreadOrder({ 'incoming:p': [] })).toEqual({});
    expect(parseMailThreadOrder({ 'incoming:p': ['не ключ'] })).toEqual({});
    expect(Object.keys(parseMailThreadOrder({ 'incoming:p': [] }))).toEqual([]);
  });

  it('в группу попадают только ключи вида `регистр:id`', () => {
    expect(
      parseMailThreadOrder({
        'incoming:p': [
          'incoming:a',
          'outgoing:b',
          'incoming:',
          'incoming:a-b',
          'Incoming:c',
          'incoming:d:e',
          ' incoming:e',
          'incoming: f',
          7,
          null,
          undefined,
        ],
      }),
    ).toEqual({ 'incoming:p': ['incoming:a', 'outgoing:b'] });
  });

  it('повтор ключа внутри группы оставляет первое вхождение', () => {
    expect(
      parseMailThreadOrder({ 'incoming:p': ['incoming:b', 'incoming:a', 'incoming:b'] }),
    ).toEqual({ 'incoming:p': ['incoming:b', 'incoming:a'] });
  });

  it('группа без родителя — пустая строка, и разбор её не теряет', () => {
    // Круг записи и чтения: письмо, начавшее цепочку, записывается под ключом `''`,
    // и разбор настроек обязан такой ключ сохранить — иначе порядок корней
    // молча обнулялся бы при каждой перезагрузке страницы.
    const saved = applyOrderPlacement({}, null, key('a'), { kind: 'last' }, []);
    expect(saved).toEqual({ '': [key('a')] });
    expect(parseMailThreadOrder(saved)).toEqual({ '': [key('a')] });
  });
});

describe('mailThreadOrderRanks: позиция письма среди соседей', () => {
  it('пустой порядок даёт пустую карту', () => {
    expect(mailThreadOrderRanks({}).size).toBe(0);
  });

  it('позиция — это место внутри своей группы, а не сквозной номер', () => {
    const ranks = mailThreadOrderRanks(
      order({ 'incoming:p': [key('a'), key('b')] }, { 'incoming:q': [key('c'), key('d')] }),
    );
    expect([...ranks]).toEqual([
      [key('a'), 0],
      [key('b'), 1],
      [key('c'), 0],
      [key('d'), 1],
    ]);
  });

  it('одинаковые позиции у соседей разных родителей — это ничья, а не порядок', () => {
    // Ничья нужна: `compareByOrderThenRegister` разводит равные ранги порядком
    // реестра, и сквозная нумерация ломала бы соседей в другой ветке.
    const ranks = mailThreadOrderRanks(
      order({ 'incoming:p': [key('a')] }, { 'incoming:q': [key('b')] }),
    );
    expect(ranks.get(key('a'))).toBe(ranks.get(key('b')));
  });

  it('письмо вне настройки ранга не получает — его место разбирает реестр', () => {
    const ranks = mailThreadOrderRanks(order({ 'incoming:p': [key('a')] }));
    expect(ranks.has(key('zzz'))).toBe(false);
    expect(ranks.get(key('zzz'))).toBeUndefined();
  });

  it('один ключ в двух группах: побеждает та группа, которая разбирается позже', () => {
    // `applyOrderPlacement` такого порядка не создаёт, но разбор не должен
    // зависеть от того, откуда значение пришло: сходящиеся группы — это данные,
    // а не повод перескакивать между ветками при перерисовке.
    const ranks = mailThreadOrderRanks(
      order({ 'incoming:p': [key('a')] }, { '': [key('b'), key('a')] }),
    );
    expect(ranks.get(key('a'))).toBe(1);
  });
});

describe('applyOrderPlacement: новое место письма в порядке соседей', () => {
  it('`keep` не переписывает настройку вовсе — возвращается тот же порядок', () => {
    const saved = order({ 'incoming:p': [key('a')] });
    expect(applyOrderPlacement(saved, 'incoming:p', key('a'), { kind: 'keep' }, [key('a')])).toBe(
      saved,
    );
  });

  it('письмо без соседей — единственный в своей группе', () => {
    expect(applyOrderPlacement({}, 'incoming:p', key('a'), { kind: 'last' }, [])).toEqual({
      'incoming:p': [key('a')],
    });
    expect(applyOrderPlacement({}, null, key('a'), { kind: 'first' }, [])).toEqual({
      '': [key('a')],
    });
  });

  it('цепочки без родителя делят одну группу: это соседи в одной линии', () => {
    const first = applyOrderPlacement({}, null, key('a'), { kind: 'last' }, []);
    const second = applyOrderPlacement(first, null, key('b'), { kind: 'last' }, [
      key('a'),
      key('b'),
    ]);
    expect(second['']).toEqual([key('a'), key('b')]);
    expect(Object.keys(second)).toEqual(['']);
  });

  it('письмо, снятое с одного родителя, не оставляет старого места в его группе', () => {
    // Ровно то, ради чего порядок хранится по родителю, а не одним списком на
    // всю переписку: общий список оставил бы ключ в старой ветке, и письмо в новой
    // встало бы по чужому месту.
    const saved = order({ 'incoming:p': [key('x'), key('y')] });
    const next = applyOrderPlacement(saved, 'incoming:q', key('x'), { kind: 'first' }, [key('z')]);
    expect(next).toEqual({
      'incoming:p': [key('y')],
      'incoming:q': [key('x'), key('z')],
    });
  });

  it('группа, из которой ушло последнее письмо, исчезает, а не остаётся пустой', () => {
    const next = applyOrderPlacement(
      order({ 'incoming:p': [key('x')] }),
      'incoming:q',
      key('x'),
      { kind: 'first' },
      [],
    );
    expect(Object.keys(next)).toEqual(['incoming:q']);
  });

  it('группа пишется целиком: ещё не записанные соседи тоже попадают в неё', () => {
    // Именно из-за целой записи перестановка монотонна: сосед, который стоял
    // выше, остаётся выше, а не прыгает вниз оттого, что его ключ впервые
    // попал в настройку.
    const saved = order({ 'incoming:p': [key('a')] });
    const next = applyOrderPlacement(saved, 'incoming:p', key('b'), { kind: 'at', index: 1 }, [
      key('a'),
      key('b'),
      key('c'),
    ]);
    expect(next['incoming:p']).toEqual([key('a'), key('b'), key('c')]);
  });

  it('`at` не сдвигает письмо, если промежуток стоит там, где оно уже есть', () => {
    const next = applyOrderPlacement({}, null, key('b'), { kind: 'at', index: 2 }, [
      key('a'),
      key('b'),
      key('c'),
    ]);
    expect(next['']).toEqual([key('a'), key('b'), key('c')]);
  });

  it('`at` с индексом ноль ставит письмо перед соседом, а не после него', () => {
    const next = applyOrderPlacement({}, null, key('b'), { kind: 'at', index: 0 }, [
      key('a'),
      key('b'),
    ]);
    expect(next['']).toEqual([key('b'), key('a')]);
  });

  it('`at` берёт индекс из списка соседей вместе с самим письмом', () => {
    // `resolveDrop` отдаёт индекс в `siblings`, где перетаскиваемое письмо ещё
    // стоит. Если бы индекс читался по списку без него, `c` встала бы после `b`
    // — то есть в промежуток после, а не перед.
    const next = applyOrderPlacement({}, null, key('c'), { kind: 'at', index: 1 }, [
      key('a'),
      key('b'),
      key('c'),
    ]);
    expect(next['']).toEqual([key('a'), key('c'), key('b')]);
  });

  it('`first` всегда первый, даже когда письмо уже было первым', () => {
    const next = applyOrderPlacement({}, null, key('a'), { kind: 'first' }, [key('a'), key('b')]);
    expect(next['']).toEqual([key('a'), key('b')]);
  });

  it('`at` за пределами списка соседей прижимается к краю, а не оставляет дыру', () => {
    const tooBig = applyOrderPlacement({}, null, key('a'), { kind: 'at', index: 99 }, [
      key('b'),
      key('c'),
    ]);
    expect(tooBig['']).toEqual([key('b'), key('c'), key('a')]);

    const negative = applyOrderPlacement({}, null, key('a'), { kind: 'at', index: -5 }, [
      key('b'),
      key('c'),
    ]);
    expect(negative['']).toEqual([key('a'), key('b'), key('c')]);
  });

  it('письмо, которого не было среди соседей, встаёт по индексу как есть', () => {
    // Сирота с точки зрения списка: новая связь только что создана, и нового
    // родителя в момент сброса ещё не было в `siblings`. Сдвигать индекс не на что.
    const next = applyOrderPlacement({}, 'incoming:p', key('new'), { kind: 'at', index: 1 }, [
      key('a'),
      key('b'),
    ]);
    expect(next['incoming:p']).toEqual([key('a'), key('new'), key('b')]);
  });

  it('перестановка в одной ветке не трогает соседей в других', () => {
    const saved = order(
      { 'incoming:p': [key('a1'), key('a2'), key('a3')] },
      { 'incoming:q': [key('b1'), key('b2'), key('b3')] },
      { '': [key('c1'), key('c2')] },
    );
    const next = applyOrderPlacement(saved, 'incoming:q', key('b3'), { kind: 'first' }, [
      key('b1'),
      key('b2'),
      key('b3'),
    ]);
    expect(next).toEqual({
      'incoming:p': [key('a1'), key('a2'), key('a3')],
      'incoming:q': [key('b3'), key('b1'), key('b2')],
      '': [key('c1'), key('c2')],
    });
  });

  it('группа длиннее потолка обрезается с начала, и вытесненное возвращается в порядок реестра', () => {
    // Обрезка не теряет письмо для пользователя: ключ просто выпадает из
    // настройки, и место письма снова разбирает реестр.
    const many: MailNodeKey[] = Array.from({ length: 200 }, (_, index) => key(`m${index}`));
    const next = applyOrderPlacement({}, null, key('new'), { kind: 'last' }, many);
    expect(next['']).toHaveLength(200);
    expect(next['']?.[199]).toBe(key('new'));
    expect(next['']).not.toContain(key('m0'));
  });

  it('исходный порядок не меняется на месте — он пришёл из кэша настройки', () => {
    const saved = order({ 'incoming:p': [key('a'), key('b')] });
    const next = applyOrderPlacement(saved, null, key('a'), { kind: 'first' }, [
      key('a'),
      key('b'),
    ]);
    expect(saved).toEqual({ 'incoming:p': [key('a'), key('b')] });
    expect(next).not.toBe(saved);
  });

  it('`last` ставит письмо после всех соседей, даже если оно было среди них', () => {
    // Дефект, который ловит этот тест: компенсация на единицу применялась и к
    // `last`, хотя `last` — не позиция в `siblings`, а длина списка без письма.
    // Первая цепочка, снятая под последнюю, вставала в середину: `['a','b','c']`,
    // письмо `a`, сброс в конец → `['b','a','c']`. Сценарий достижим из
    // интерфейса: `resolveDrop` отдаёт `{ parentKey: null, placement: { kind:
    // 'last' } }` для промежутка под последним письмом, а `siblings` там — это
    // `layout.children.get(null)`, и перетаскиваемое письмо в нём есть. Исправлено
    // так, что сдвиг остался только у `at` — у него индекс позиционный.
    const next = applyOrderPlacement({}, null, key('a'), { kind: 'last' }, [
      key('a'),
      key('b'),
      key('c'),
    ]);
    expect(next['']).toEqual([key('b'), key('c'), key('a')]);
  });

  it('`last` выносит письмо из середины в конец, не ломая порядок остальных', () => {
    // Письмо, снятое из середины, ничего не двигает вокруг себя: после удаления
    // `b` остаётся `a, c, d`, и в конце именно этот список, а не список с дырой
    // на месте `b`.
    const next = applyOrderPlacement({}, null, key('b'), { kind: 'last' }, [
      key('a'),
      key('b'),
      key('c'),
      key('d'),
    ]);
    expect(next['']).toEqual([key('a'), key('c'), key('d'), key('b')]);
  });

  it('`last` с письмом, которого ещё не было среди соседей, встаёт после всех', () => {
    // Сирота с точки зрения списка: связь только что создана, нового родителя в
    // момент записи ещё нет в `siblings`, сдвигать индекс не на что.
    const next = applyOrderPlacement({}, 'incoming:p', key('new'), { kind: 'last' }, [
      key('a'),
      key('b'),
      key('c'),
    ]);
    expect(next['incoming:p']).toEqual([key('a'), key('b'), key('c'), key('new')]);
  });

  it('`last` для уже последнего письма — это пустое место, а не сдвиг назад', () => {
    // Письмо, которое уже стоит последним, при сбросе в тот же хвост не должно
    // переезжать выше предпоследнего: сдвиг на единицу здесь дал бы ровно это.
    const next = applyOrderPlacement({}, null, key('c'), { kind: 'last' }, [
      key('a'),
      key('b'),
      key('c'),
    ]);
    expect(next['']).toEqual([key('a'), key('b'), key('c')]);
  });

  it('`first` выносит письмо из середины в начало', () => {
    // Спарка к `last`: если правку на сдвиг применять ко всем видам, `first`
    // начнёт вести себя так же, как раньше вёл `last`.
    const next = applyOrderPlacement({}, null, key('b'), { kind: 'first' }, [
      key('a'),
      key('b'),
      key('c'),
    ]);
    expect(next['']).toEqual([key('b'), key('a'), key('c')]);
  });

  it('`at` со сдвигом на единицу, когда письмо стоит раньше промежутка', () => {
    // Обратная сторона правки: у `at` индекс — позиция в `siblings`, а `siblings`
    // включает само письмо. Промежуток стоял перед `c` (позиция 2), после снятия
    // `a` из списка тот же промежуток — это позиция 1, иначе `a` переехал бы
    // после `c`, то есть в соседний промежуток.
    const next = applyOrderPlacement({}, null, key('a'), { kind: 'at', index: 2 }, [
      key('a'),
      key('b'),
      key('c'),
    ]);
    expect(next['']).toEqual([key('b'), key('a'), key('c')]);
  });

  it('`last` с письмом, которого не было среди соседей, ведёт себя верно', () => {
    const next = applyOrderPlacement({}, 'incoming:p', key('new'), { kind: 'last' }, [
      key('a'),
      key('b'),
    ]);
    expect(next['incoming:p']).toEqual([key('a'), key('b'), key('new')]);
  });
});

describe('useMailThreadOrder: чтение и запись настройки', () => {
  it('чтение и запись идут через одну и ту же строку настройки', () => {
    // Две разные строки означали бы чтение из одного места, а запись в другое:
    // порядок молча не возвращался бы после перезагрузки.
    const { result } = renderHook(() => useMailThreadOrder());

    expect(hooks.useUserSetting).toHaveBeenCalledWith(MAIL_THREAD_ORDER_KEY);
    expect(hooks.useUpsertUserSetting).toHaveBeenCalledWith(MAIL_THREAD_ORDER_KEY);
    expect(result.current.order).toEqual({});
  });

  it('ещё не пришедшая настройка даёт пустой порядок и пустые ранги', () => {
    hooks.state.setting = undefined;
    const { result } = renderHook(() => useMailThreadOrder());

    expect(result.current.order).toEqual({});
    expect(result.current.ranks.size).toBe(0);
  });

  it('кривое значение настройки разбирается в пустой порядок, а не падает в отрисовке', () => {
    hooks.state.setting = { 'incoming:p': 'не массив' };
    const { result } = renderHook(() => useMailThreadOrder());

    expect(result.current.order).toEqual({});
  });

  it('ранги строятся из разобранной настройки', () => {
    hooks.state.setting = { 'incoming:p': ['incoming:a', 'incoming:b'] };
    const { result } = renderHook(() => useMailThreadOrder());

    expect(result.current.ranks.get('incoming:a')).toBe(0);
    expect(result.current.ranks.get('incoming:b')).toBe(1);
  });

  it('`place` записывает весь новый порядок, а не только переставленное письмо', () => {
    hooks.state.setting = { 'incoming:p': ['incoming:a'] };
    const { result } = renderHook(() => useMailThreadOrder());
    const placement: MailOrderPlacement = { kind: 'at', index: 1 };

    act(() =>
      result.current.place('incoming:b', 'incoming:p', placement, ['incoming:a', 'incoming:b']),
    );

    expect(hooks.mutate).toHaveBeenCalledWith({
      'incoming:p': ['incoming:a', 'incoming:b'],
    });
  });

  it('провал записи не ломает линию: она уже перерисована по связям', () => {
    // Хук ничего не ждёт и не разворачивает: `place` — одна запись в кэш
    // настроек, а линия нарисована заново по `mail_relations`.
    hooks.state.setting = {};
    const { result } = renderHook(() => useMailThreadOrder());

    act(() => result.current.place('incoming:a', null, { kind: 'first' }, ['incoming:a']));

    expect(hooks.mutate).toHaveBeenCalledTimes(1);
    expect(hooks.mutate.mock.results).toHaveLength(1);
  });
});
