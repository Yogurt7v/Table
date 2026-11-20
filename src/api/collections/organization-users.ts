/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/organization-users`:
 * реализация живёт в домене `@/features/admin/api`.
 */

export {
  getOrganizationUsers,
  createOrganizationUser,
  updateOrganizationUser,
  deleteOrganizationUser,
} from '@/features/admin/api/organization-users';
