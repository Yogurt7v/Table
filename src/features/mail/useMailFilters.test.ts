import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  activeFilterGroups,
  buildFilterChips,
  buildMailListQuery,
  createDefaultMailFilters,
  cycleAttachmentFilter,
  DEFAULT_MAIL_FILTERS,
  hasActiveFilters,
  nextSortDirection,
  resetFilterGroup,
  toggleInList,
  useMailFilters,
} from './useMailFilters';
import { LIVE_MAIL_SORT, LIVE_MAIL_SORT_ASC } from '@/api/mail';
import { MAIL_NO_ACCOUNTING_OBJECT_LABEL } from './mail-labels';
import { MAIL_DELIVERY_METHOD_NAMES } from '@/shared/types';
import type { MailFilterChip, MailFilterState } from './useMailFilters';

function withOverrides(overrides: Partial<MailFilterState>): MailFilterState {
  return { ...createDefaultMailFilters(), ...overrides };
}

const CHIP_CONTEXT = {
  mailType: 'incoming' as const,
  objectNames: new Map([
    ['obj-1', 'Основной склад'],
    ['obj-2', 'Офис'],
  ]),
  responsibleNames: new Map([['user-1', 'Иванова И. И.']]),
  deliveryLabels: MAIL_DELIVERY_METHOD_NAMES,
};

describe('buildMailListQuery', () => {
  it('пустые фильтры дают пустой запрос, а не параметры-пустышки', () => {
    // Пустой `counterparty: ''` изменил бы ключ React Query и заставил бы
    // перезапросить тот же список.
    expect(buildMailListQuery(DEFAULT_MAIL_FILTERS)).toEqual({});
  });

  it('поиск уходит на сервер, а не фильтрует страницу на клиенте', () => {
    expect(buildMailListQuery(withOverrides({ search: '  договор  ' }))).toEqual({
      search: 'договор',
    });
  });

  it('период раскрывается в границы дат', () => {
    expect(
      buildMailListQuery(
        withOverrides({ period: 'custom', customFrom: '2026-01-01', customTo: '2026-01-31' }),
      ),
    ).toEqual({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
  });

  it('объект учёта уходит списком id', () => {
    expect(buildMailListQuery(withOverrides({ accountingObjectIds: ['obj-1', 'obj-2'] }))).toEqual({
      accountingObjectIds: ['obj-1', 'obj-2'],
    });
  });

  it('«без объекта учёта» — отдельный флаг API', () => {
    expect(buildMailListQuery(withOverrides({ withoutAccountingObject: true }))).toEqual({
      withoutAccountingObject: true,
    });
  });

  it('способ доставки уходит списком, «не указан» — отдельным флагом', () => {
    expect(buildMailListQuery(withOverrides({ deliveryMethods: ['email', 'post'] }))).toEqual({
      deliveryMethods: ['email', 'post'],
    });
    expect(buildMailListQuery(withOverrides({ withoutDeliveryMethod: true }))).toEqual({
      withoutDeliveryMethod: true,
    });
  });

  it('контрагент обрезается по краям', () => {
    expect(buildMailListQuery(withOverrides({ counterparty: '  ООО Ромашка ' }))).toEqual({
      counterparty: 'ООО Ромашка',
    });
  });

  // `withFiles` и `hasRelations` намеренно НЕ отправляются: `applyClientOnlyMailFlags`
  // фильтрует через `?=` со списком id, на что PocketBase отвечает 400 и роняет
  // весь запрос реестра. Оба отбора применяются к уже загруженной странице.
  it('отбор по вложениям не уходит на сервер', () => {
    expect(buildMailListQuery(withOverrides({ attachments: 'with' }))).toEqual({});
    expect(buildMailListQuery(withOverrides({ attachments: 'without' }))).toEqual({});
  });

  it('отбор по связанным письмам не уходит на сервер', () => {
    expect(buildMailListQuery(withOverrides({ hasRelations: true }))).toEqual({});
  });

  it('обратный порядок уходит на сервер явной строкой sort', () => {
    expect(buildMailListQuery(withOverrides({ sortDirection: 'asc' }))).toEqual({
      sort: LIVE_MAIL_SORT_ASC,
    });
  });

  it('порядок по умолчанию sort не добавляет — он и есть умолчание сервера', () => {
    // Лишний `sort: LIVE_MAIL_SORT` изменил бы ключ React Query, не изменив
    // выдачу, поэтому в состоянии по умолчанию его быть не должно.
    expect(buildMailListQuery(withOverrides({ sortDirection: 'desc' }))).toEqual({});
  });

  it('порядок едет вместе с остальными фильтрами, а не вместо них', () => {
    expect(
      buildMailListQuery(
        withOverrides({
          sortDirection: 'asc',
          counterparty: 'ООО Ромашка',
          deliveryMethods: ['post'],
        }),
      ),
    ).toEqual({ counterparty: 'ООО Ромашка', deliveryMethods: ['post'], sort: LIVE_MAIL_SORT_ASC });
  });
});

describe('порядок живого реестра', () => {
  it('две строки сортировки совпадают по ключам и различаются только знаком', () => {
    // Расхождение означало бы другой регистр, а не другой порядок: потерянный
    // `-seq` снова разъезжает порядок внутри дня, а потерянный `-created`
    // возвращает двойным по `(date, seq)` строкам право прыгать через границу
    // страниц. Поэтому строки выводятся одна из другой, а не пишутся рядом.
    expect(LIVE_MAIL_SORT).toBe('-date,-seq,-created');
    expect(LIVE_MAIL_SORT_ASC).toBe('date,seq,created');
    expect(LIVE_MAIL_SORT_ASC).toBe(LIVE_MAIL_SORT.replace(/-/g, ''));
  });

  it('ни один ключ сортировки не пропадает при смене направления', () => {
    const keysOf = (sort: string) => sort.split(',').map((key) => key.replace('-', ''));
    expect(keysOf(LIVE_MAIL_SORT_ASC)).toEqual(keysOf(LIVE_MAIL_SORT));
  });

  it('направление переключается и обратно', () => {
    expect(nextSortDirection('desc')).toBe('asc');
    expect(nextSortDirection('asc')).toBe('desc');
  });
});

describe('activeFilterGroups', () => {
  it('состояние по умолчанию не считается активным', () => {
    expect(activeFilterGroups(DEFAULT_MAIL_FILTERS)).toEqual([]);
  });

  it('каждая группа считается один раз, независимо от числа значений', () => {
    expect(
      activeFilterGroups(
        withOverrides({
          accountingObjectIds: ['obj-1', 'obj-2'],
          deliveryMethods: ['email', 'post'],
          responsibleIds: ['user-1'],
        }),
      ),
    ).toEqual(['accountingObject', 'deliveryMethod', 'responsible']);
  });

  it('пустой произвольный диапазон не считается активным', () => {
    expect(
      activeFilterGroups(withOverrides({ period: 'custom', customFrom: '', customTo: '' })),
    ).toEqual([]);
    expect(
      activeFilterGroups(withOverrides({ period: 'custom', customFrom: '2026-01-01' })),
    ).toEqual(['period']);
  });

  it('поиск не попадает в счётчик групп', () => {
    expect(activeFilterGroups(withOverrides({ search: 'договор' }))).toEqual([]);
  });

  it('обратный порядок — не фильтр: ни в счётчике, ни чипом', () => {
    // Иначе кнопка «Фильтр» посинеет от настройки показа, а сброс фильтров
    // начнёт молча отменять выбранный порядок.
    expect(activeFilterGroups(withOverrides({ sortDirection: 'asc' }))).toEqual([]);
    expect(hasActiveFilters(withOverrides({ sortDirection: 'asc' }))).toBe(false);
    expect(buildFilterChips(withOverrides({ sortDirection: 'asc' }), CHIP_CONTEXT)).toEqual([]);
  });
});

describe('useMailFilters — переключатель порядка', () => {
  it('по умолчанию реестр идёт от новых к старым, и направление ни на что не влияет', () => {
    const { result } = renderHook(() => useMailFilters());

    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.activeCount).toBe(0);
    expect(result.current.query).toEqual({});
  });

  it('переключение меняет направление и включает sort в запрос', () => {
    const { result } = renderHook(() => useMailFilters());

    act(() => result.current.toggleSortDirection());

    expect(result.current.sortDirection).toBe('asc');
    expect(result.current.query).toEqual({ sort: LIVE_MAIL_SORT_ASC });

    act(() => result.current.toggleSortDirection());

    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.query).toEqual({});
  });

  it('переключение не трогает ни фильтры, ни счётчик активных', () => {
    const { result } = renderHook(() => useMailFilters());

    act(() => result.current.toggleAccountingObject('obj-1'));
    const activeBefore = result.current.activeCount;

    act(() => result.current.toggleSortDirection());

    expect(result.current.activeCount).toBe(activeBefore);
    expect(result.current.query.accountingObjectIds).toEqual(['obj-1']);
  });

  it('сброс фильтров сохраняет порядок показа — он выбран, а не отобран', () => {
    const { result } = renderHook(() => useMailFilters());

    act(() => result.current.toggleSortDirection());
    act(() => result.current.setCounterparty('ООО Ромашка'));
    act(() => result.current.resetAll());

    expect(result.current.filters.sortDirection).toBe('asc');
    expect(result.current.filters.counterparty).toBe('');
    expect(result.current.activeCount).toBe(0);
    expect(result.current.query).toEqual({ sort: LIVE_MAIL_SORT_ASC });
  });

  it('сброс фильтров сохраняет и поиск, как и раньше', () => {
    const { result } = renderHook(() => useMailFilters());

    act(() => result.current.setSearch('договор'));
    act(() => result.current.resetAll());

    expect(result.current.filters.search).toBe('договор');
  });
});

describe('resetFilterGroup', () => {
  it('сбрасывает только свою группу', () => {
    const state = withOverrides({
      period: 'week',
      counterparty: 'ООО Ромашка',
      hasRelations: true,
    });
    const next = resetFilterGroup(state, 'counterparty');
    expect(next.counterparty).toBe('');
    expect(next.period).toBe('week');
    expect(next.hasRelations).toBe(true);
  });

  it('период сбрасывается вместе со своими границами', () => {
    const next = resetFilterGroup(
      withOverrides({ period: 'custom', customFrom: '2026-01-01', customTo: '2026-02-01' }),
      'period',
    );
    expect(next).toMatchObject({ period: 'all', customFrom: '', customTo: '' });
  });
});

describe('cycleAttachmentFilter', () => {
  it('перебирает три состояния по кругу', () => {
    expect(cycleAttachmentFilter('any')).toBe('with');
    expect(cycleAttachmentFilter('with')).toBe('without');
    expect(cycleAttachmentFilter('without')).toBe('any');
  });
});

describe('toggleInList', () => {
  it('добавляет и убирает значение', () => {
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('buildFilterChips', () => {
  it('без фильтров чипов нет', () => {
    expect(buildFilterChips(DEFAULT_MAIL_FILTERS, CHIP_CONTEXT)).toEqual([]);
  });

  it('на каждый объект учёта — свой чип с его названием', () => {
    const chips = buildFilterChips(
      withOverrides({ accountingObjectIds: ['obj-1', 'obj-2'] }),
      CHIP_CONTEXT,
    );
    expect(chips).toEqual([
      { group: 'accountingObject', label: 'Основной склад', value: 'obj-1' },
      { group: 'accountingObject', label: 'Офис', value: 'obj-2' },
    ]);
  });

  it('чипы объекта несут id для снятия, а не подпись', () => {
    const chips = buildFilterChips(withOverrides({ withoutAccountingObject: true }), CHIP_CONTEXT);
    expect(chips[0]?.label).toBe(MAIL_NO_ACCOUNTING_OBJECT_LABEL);
    expect(chips[0]?.value).not.toBe(MAIL_NO_ACCOUNTING_OBJECT_LABEL);
  });

  it('способ доставки печатается подписью, но снимается по значению', () => {
    const chips = buildFilterChips(withOverrides({ deliveryMethods: ['email'] }), CHIP_CONTEXT);
    expect(chips[0]?.label).toBe(MAIL_DELIVERY_METHOD_NAMES.email);
    expect(chips[0]?.value).toBe('email');
  });

  it('контрагент подписан по регистру, который открыт', () => {
    const state = withOverrides({ counterparty: 'ООО Ромашка' });
    expect(buildFilterChips(state, CHIP_CONTEXT)[0]?.label).toContain('Отправитель');
    expect(buildFilterChips(state, { ...CHIP_CONTEXT, mailType: 'outgoing' })[0]?.label).toContain(
      'Получатель',
    );
  });

  it('вложения и связи дают по чипу', () => {
    const chips = buildFilterChips(
      withOverrides({ attachments: 'without', hasRelations: true }),
      CHIP_CONTEXT,
    );
    expect(chips.map((chip) => chip.group)).toEqual(['attachments', 'relations']);
  });
});

describe('MailFilterChip', () => {
  it('ключ чипа уникален в пределах страницы фильтров', () => {
    const chips: MailFilterChip[] = buildFilterChips(
      withOverrides({
        accountingObjectIds: ['obj-1', 'obj-2'],
        withoutAccountingObject: true,
        deliveryMethods: ['email', 'post'],
        withoutDeliveryMethod: true,
      }),
      CHIP_CONTEXT,
    );
    const keys = chips.map((chip) => `${chip.group}:${chip.value}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
