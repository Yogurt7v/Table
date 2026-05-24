import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, Group, Text, Select, Anchor, ActionIcon } from '@mantine/core';
import { IconHome } from '@tabler/icons-react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrg } from '@/shared/context/OrgContext';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { InvoiceSearch } from '@/features/invoices/InvoiceSearch';

export function AppLayout() {
  const { user, logout } = useAuth();
  const { currentOrgId, setCurrentOrgId, organizations, currentOrg } = useOrg();
  const currentRole = useCurrentUserRole(currentOrgId);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentOrg?.color) {
      document.body.style.setProperty('--org-color', currentOrg.color);
    }
  }, [currentOrg]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header
        style={{ borderBottom: '3px solid var(--org-color, #228be6)' }}
      >
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/')}>
              <IconHome size={20} />
            </ActionIcon>
            <Select
              data={organizations.map((o) => ({ value: o.id, label: o.name, color: o.color }))}
              value={currentOrgId || null}
              onChange={(v) => v && setCurrentOrgId(v)}
              placeholder="Выберите организацию"
              w={280}
              clearable={false}
              size="sm"
              leftSection={
                currentOrg ? (
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: currentOrg.color,
                    }}
                  />
                ) : undefined
              }
              leftSectionPointerEvents="none"
              renderOption={({ option }) => (
                <Group gap="xs">
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: (option as Record<string, unknown>).color as string,
                    }}
                  />
                  <Text>{option.label}</Text>
                </Group>
              )}
            />
            <InvoiceSearch />
          </Group>
          <Group>
            {/* <Anchor size="sm" onClick={() => navigate('/payment-report')}>
              Отчёт по оплате
            </Anchor> */}
            {currentOrgId && currentRole !== 'boss' && currentRole !== 'guest' && (
              <Anchor size="sm" onClick={() => navigate('/admin')}>
                Панель администратора
              </Anchor>
            )}
            <Text size="sm">{user?.name || user?.login || 'Пользователь'}</Text>
            <Text
              size="sm"
              c="dimmed"
              style={{ cursor: 'pointer' }}
              onClick={handleLogout}
            >
              Выйти
            </Text>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
