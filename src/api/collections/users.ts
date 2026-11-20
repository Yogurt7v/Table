/**
 * Совместимость импортов `@/api/collections` и `@/api/collections/users`:
 * реализация живёт в домене `@/features/admin/api`.
 */

export { getUsers, createUser, deleteUser, updateUser } from '@/features/admin/api/users';
export type { UpdateUserData } from '@/features/admin/api/users';
