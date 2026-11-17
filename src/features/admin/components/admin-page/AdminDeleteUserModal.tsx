import { Stack, Text } from '@mantine/core';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { UserDeleteConsequences } from '@/features/admin/user-delete-consequences';
import type { AdminUserTarget } from './admin-page-types';

/** Пропсы подтверждения удаления пользователя. */
export interface AdminDeleteUserModalProps {
  target: AdminUserTarget | null;
  consequences: UserDeleteConsequences | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Подтверждение удаления пользователя.
 * Рендерит вопрос с именем, список организаций для исключения и предупреждение
 * об единственном администраторе.
 */
export function AdminDeleteUserModal({
  target,
  consequences,
  isPending,
  onClose,
  onConfirm,
}: AdminDeleteUserModalProps) {
  return (
    <ConfirmModal
      opened={target !== null}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Удаление пользователя"
      loading={isPending}
      message={
        <Stack gap={6}>
          {/* Вопрос с именем пользователя */}
          <Text size="sm">
            Вы уверены, что хотите удалить пользователя «{target?.name ?? ''}»? Созданные им счета
            останутся в системе.
          </Text>

          {/* Организации, из которых пользователя исключат */}
          {consequences && consequences.memberships.length > 0 && (
            <Text size="sm">
              Будет исключён из организаций:{' '}
              {consequences.memberships
                .map(
                  (membership) => `«${membership.orgName}» (${membership.roleLabel.toLowerCase()})`,
                )
                .join(', ')}
              .
            </Text>
          )}

          {/* Пользователь не состоит ни в одной организации */}
          {consequences && consequences.memberships.length === 0 && (
            <Text size="sm" c="dimmed">
              Не состоит ни в одной организации.
            </Text>
          )}

          {/* Предупреждение об единственном администраторе организации */}
          {consequences?.soleAdminOf.map((orgName) => (
            <Text key={orgName} size="sm" c="orange">
              Внимание: он единственный администратор организации «{orgName}». Без админа управление
              ею будет невозможно.
            </Text>
          ))}
        </Stack>
      }
    />
  );
}
