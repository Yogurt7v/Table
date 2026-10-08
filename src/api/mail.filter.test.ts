import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ListResult, RecordListOptions, RecordModel } from 'pocketbase';
import { pb } from './client';
import { getIncomingMails, getOutgoingMails } from './mail';
import type { MailListParams } from '@/shared/types';

const ORG = 'yvyg08lk9b61me0';

function emptyPage(collectionName: string): ListResult<RecordModel> {
  return {
    page: 1,
    perPage: 20,
    totalItems: 0,
    totalPages: 0,
    items: [{ id: 'stub01hxyz', collectionId: 'pbc_1hxyz', collectionName } satisfies RecordModel],
  };
}

/** Фильтр, который ушёл на сервер: `getList` — третий аргумент несёт `filter`. */
function capturedFilter(options: unknown): string {
  const { filter } = (options ?? {}) as RecordListOptions;
  return filter ?? '';
}

const spies: { mockRestore: () => void }[] = [];

function spyOnGetList(collectionName: string) {
  const service = pb.collection(collectionName);
  const spy = vi.spyOn(service, 'getList').mockResolvedValue(emptyPage(collectionName));
  spies.push(spy);
  return spy;
}

function params(overrides: Partial<MailListParams> = {}): MailListParams {
  return { organizationId: ORG, ...overrides };
}

/** Список операндов у любого оператора «any of» PocketBase отвергает 400. */
function expectNoListOperand(filter: string) {
  expect(filter).not.toMatch(/\?=\s*[{[]/);
}

async function incomingFilter(overrides: Partial<MailListParams> = {}): Promise<string> {
  const spy = spyOnGetList('incoming_mails');
  await getIncomingMails(params(overrides));
  return capturedFilter(spy.mock.calls[0]?.[2]);
}

describe('buildMailFilter — «Способ доставки»', () => {
  it('один способ доставки уезжает равенством, а не списком в ?=', async () => {
    const filter = await incomingFilter({ deliveryMethods: ['email'] });
    expect(filter).toContain('delivery_method = "email"');
    expectNoListOperand(filter);
  });

  it('несколько способов доставки соединяются ||, списка в ?= нет', async () => {
    const filter = await incomingFilter({ deliveryMethods: ['email', 'post'] });
    expect(filter).toContain('delivery_method = "email" || delivery_method = "post"');
    expectNoListOperand(filter);
  });

  it('без способа доставки остаётся ветка «null или пустая строка»', async () => {
    const filter = await incomingFilter({
      withoutDeliveryMethod: true,
      deliveryMethods: ['email'],
    });
    expect(filter).toContain('(delivery_method = null || delivery_method = "")');
    expect(filter).not.toContain('delivery_method = "email"');
    expectNoListOperand(filter);
  });
});

describe('buildMailFilter — «Объект учёта»', () => {
  it('выбранные объекты соединяются ||, списка в ?= нет', async () => {
    const filter = await incomingFilter({ accountingObjectIds: ['a', 'b'] });
    expect(filter).toContain('accounting_object_id = "a" || accounting_object_id = "b"');
    expectNoListOperand(filter);
  });

  it('без объекта учёта остаётся ветка accounting_object_id = null', async () => {
    const filter = await incomingFilter({
      withoutAccountingObject: true,
      accountingObjectIds: ['a'],
    });
    expect(filter).toContain('accounting_object_id = null');
    expect(filter).not.toContain('accounting_object_id = "a"');
    expectNoListOperand(filter);
  });

  it('все отборы вместе остаются без списочного операнда', async () => {
    const filter = await incomingFilter({
      accountingObjectIds: ['a'],
      deliveryMethods: ['email'],
      responsibleIds: ['u1', 'u2'],
      counterparty: 'ООО Ромашка',
    });
    expectNoListOperand(filter);
    expect(filter).toContain('accounting_object_id = "a"');
    expect(filter).toContain('delivery_method = "email"');
    expect(filter).toContain('(responsible ~ "u1") || (responsible ~ "u2")');
  });
});

describe('исходящий реестр', () => {
  it('зеркалит входящий по способам доставки', async () => {
    const spy = spyOnGetList('outgoing_mails');
    await getOutgoingMails(params({ deliveryMethods: ['email', 'post'] }));
    const filter = capturedFilter(spy.mock.calls[0]?.[2]);
    expect(filter).toContain('delivery_method = "email" || delivery_method = "post"');
    expectNoListOperand(filter);
  });
});

afterEach(() => {
  while (spies.length > 0) spies.pop()?.mockRestore();
});
