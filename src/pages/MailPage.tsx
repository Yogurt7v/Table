import { Container } from '@mantine/core';
import { useOrg } from '@/shared/context/OrgContext';
import { useMailPermissions } from '@/shared/hooks/useMailPermissions';
import { MailSection } from '@/features/mail/MailSection';

/**
 * Страница реестра писем. Права решают всё: без `can_view_mails` страница не
 * рендерит ничего. Ссылка на неё тоже скрыта на главной, но прятать только
 * ссылку было бы недостаточно — адрес `/mail` можно ввести руками, поэтому
 * проверка продублирована здесь, на границе экрана.
 */
export function MailPage() {
  const { currentOrgId } = useOrg();
  const permissions = useMailPermissions(currentOrgId);

  if (!currentOrgId || !permissions.canView) return null;

  return (
    <Container size="fluid" py={{ base: 'xs', sm: 'md' }}>
      <MailSection orgId={currentOrgId} />
    </Container>
  );
}
