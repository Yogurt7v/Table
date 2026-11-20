/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/organizations`:
 * реализация живёт в домене `@/features/admin/api`.
 */

export {
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '@/features/admin/api/organizations';
