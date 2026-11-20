/** CRUD организаций. */

import { pb } from '@/api/client';
import type { IOrganization } from '@/shared/types';

/** Возвращает список всех организаций. */
export function getOrganizations() {
  return pb.collection('organizations').getFullList<IOrganization>({ sort: 'created' });
}

/** Создаёт организацию с именем и цветом. */
export function createOrganization(name: string, color: string) {
  return pb.collection('organizations').create<IOrganization>({ name, color });
}

/** Обновляет имя и цвет организации. */
export function updateOrganization(id: string, name: string, color: string) {
  return pb.collection('organizations').update<IOrganization>(id, { name, color });
}

/** Удаляет организацию по идентификатору. */
export function deleteOrganization(id: string) {
  return pb.collection('organizations').delete(id);
}
