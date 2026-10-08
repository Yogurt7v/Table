import { Center, Container, Loader } from '@mantine/core';
import { useOrg } from '@/shared/context/OrgContext';
import { useMailPermissions } from '@/shared/hooks/useMailPermissions';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { MailSection } from '@/features/mail/MailSection';

/**
 * Страница реестра писем. Права решают всё: без `can_view_mails` страница не
 * рендерит ничего. Ссылка на неё тоже скрыта на главной, но прятать только
 * ссылку было бы недостаточно — адрес `/mail` можно ввести руками, поэтому
 * проверка продублирована здесь, на границе экрана.
 *
 * Пока права ещё не приехали, страница показывает `Loader`, а не пустоту:
 * `useMailPermissions` отдаёт набор «всё запрещено» и во время загрузки, и при
 * реальном отказе, и различить их можно только по флагам загрузки. Список
 * `organization_users` читается здесь тем же хуком и с тем же ключом
 * `['organization_users']`, что и внутри `useMailPermissions`,
 * `useAccessibleObjects` и `useCurrentUserRole`, — лишнего запроса это не
 * добавляет.
 */
export function MailPage() {
  const { currentOrgId, organizationsLoading } = useOrg();
  const permissions = useMailPermissions(currentOrgId);
  const { isLoading: orgUsersLoading } = useOrganizationUsers();

  if (!currentOrgId || !permissions.canView) {
    if (organizationsLoading || orgUsersLoading)
      return (
        <Center py="xl">
          <Loader />
        </Center>
      );
    return null;
  }

  return (
    <Container size="fluid" py={{ base: 'xs', sm: 'md' }}>
      <MailSection orgId={currentOrgId} />
    </Container>
  );
}
