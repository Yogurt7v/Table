/** Членства пользователей в организациях (роли и доступы). */

import { pb } from '../client.ts';
import type { IOrganizationUser } from '@/shared/types';

/** Возвращает все членства пользователей в организациях с раскрытием связей. */
export function getOrganizationUsers() {
  return pb.collection('organization_users').getFullList<IOrganizationUser>({
    expand: 'user_id,organization_id',
    sort: 'created',
  });
}

/** Создаёт членство пользователя в организации с ролью и доступами по умолчанию. */
export function createOrganizationUser(
  userId: string,
  organizationId: string,
  role: IOrganizationUser['role'],
  objectIds?: string[],
) {
  return pb.collection('organization_users').create<IOrganizationUser>({
    user_id: userId,
    organization_id: organizationId,
    role,
    objects: objectIds,
    // Новые членства по умолчанию видят счета и документы;
    // администратор может отключить через панель администрирования.
    can_view_invoices: true,
    can_view_documents: true,
  });
}

/** Обновляет роль и/или список объектов членства пользователя в организации. */
export function updateOrganizationUser(
  id: string,
  data: { role?: IOrganizationUser['role']; objects?: string[] },
) {
  return pb.collection('organization_users').update<IOrganizationUser>(id, data);
}

/** Удаляет членство пользователя в организации. */
export function deleteOrganizationUser(id: string) {
  return pb.collection('organization_users').delete(id);
}
