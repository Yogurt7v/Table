/** Объекты учёта организации: CRUD, порядок и порядок контрагентов. */

import { pb } from '@/api/client';
import type { IAccountingObject } from '@/shared/types';

/** Возвращает все объекты учёта. */
export function getAllAccountingObjects() {
  return pb.collection('accounting_objects').getFullList<IAccountingObject>({
    sort: 'sort,created',
  });
}

/** Возвращает объекты учёта организации. */
export function getAccountingObjects(orgId: string) {
  return pb.collection('accounting_objects').getFullList<IAccountingObject>({
    filter: `organization_id = "${orgId}"`,
    sort: 'sort,created',
  });
}

/** Создаёт объект учёта, присваивая следующий порядковый номер в организации. */
export async function createAccountingObject(organizationId: string, name: string) {
  const highest = await pb.collection('accounting_objects').getList<IAccountingObject>(1, 1, {
    filter: `organization_id = "${organizationId}" && sort != null`,
    sort: '-sort',
    fields: 'sort',
  });
  const maxSort = highest.items[0]?.sort ?? 0;

  return pb.collection('accounting_objects').create<IAccountingObject>({
    organization_id: organizationId,
    name,
    sort: maxSort + 1,
  });
}

/** Обновляет имя и/или признак активности объекта учёта. */
export function updateAccountingObject(id: string, name: string, isActive?: boolean) {
  return pb.collection('accounting_objects').update<IAccountingObject>(id, {
    name,
    ...(isActive === undefined ? {} : { is_active: isActive }),
  });
}

/** Удаляет объект учёта. */
export function deleteAccountingObject(id: string) {
  return pb.collection('accounting_objects').delete(id);
}

/** Сохраняет новый порядок объектов учёта по списку идентификаторов. */
export async function updateAccountingObjectsOrder(orderedIds: string[]) {
  return Promise.all(
    orderedIds.map((id, i) =>
      pb.collection('accounting_objects').update<IAccountingObject>(id, { sort: i + 1 }),
    ),
  );
}

/** Сохраняет пользовательский порядок контрагентов для объекта учёта. */
export function updateAccountingObjectCounterpartyOrder(
  objectId: string,
  counterpartyOrder: string[],
) {
  return pb
    .collection('accounting_objects')
    .update<IAccountingObject>(objectId, { counterparty_order: counterpartyOrder });
}
