import { describe, it, expect } from 'vitest';
import {
  activeFilterGroups,
  buildFilterChips,
  buildMailListQuery,
  createDefaultMailFilters,
  cycleAttachmentFilter,
  DEFAULT_MAIL_FILTERS,
  resetFilterGroup,
  toggleInList,
} from './useMailFilters';
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
