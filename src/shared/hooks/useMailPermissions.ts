/**
 * Совместимость пути: реализация `useMailPermissions` перенесена в домен почты
 * (`@/features/mail/hooks/useMailPermissions`). Публичный импорт
 * `@/shared/hooks/useMailPermissions` сохранён barrel-реэкспортом.
 */
export { useMailPermissions } from '@/features/mail/hooks/useMailPermissions';
export type { MailPermissions } from '@/features/mail/model/mail-field-access';
