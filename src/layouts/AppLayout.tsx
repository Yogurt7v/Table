import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, Group, Text, Select, Anchor, ActionIcon, Box, Stack, Tooltip } from '@mantine/core';
import { IconHome, IconSettings, IconUser, IconLogout } from '@tabler/icons-react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { useOrg } from '@/shared/context/OrgContext';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { InvoiceSearch } from '@/features/invoices/InvoiceSearch';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';

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
    <AppShell header={{ height: { base: 88, sm: 56 } }} padding="md">
      <AppShell.Header
        style={{ borderBottom: '3px solid var(--org-color, #228be6)' }}
      >
        {/* Mobile layout */}
        <Box hiddenFrom="sm" h="100%" px="md">
          <Stack h="100%" gap={4} justify="center">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/')}>
                  <IconHome size={22} />
                </ActionIcon>
                <Select
                  data={organizations.map((o) => ({ value: o.id, label: o.name, color: o.color }))}
                  value={currentOrgId || null}
                  onChange={(v) => v && setCurrentOrgId(v)}
                  placeholder="Выберите организацию"
                  clearable={false}
                  size="sm"
                  style={{ flex: 1, minWidth: 0 }}
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
              </Group>
              <Group gap={4} wrap="nowrap">
                {currentOrgId && (currentRole === 'admin' || currentRole === 'moderator') && (
                  <NotificationsBell />
                )}
                {currentOrgId && (currentRole === 'admin' || currentRole === 'moderator') && (
                  <Tooltip label="Панель администратора">
                    <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/admin')}>
                      <IconSettings size={22} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label={user?.name || user?.login || 'Пользователь'}>
                  <ActionIcon variant="subtle" color="gray">
                    <IconUser size={22} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Выйти">
                  <ActionIcon variant="subtle" color="gray" onClick={handleLogout}>
                    <IconLogout size={22} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <InvoiceSearch />
          </Stack>
        </Box>

        {/* Desktop layout */}
        <Box visibleFrom="sm" h="100%" px="md">
          <Group h="100%" justify="space-between">
            <Group>
              <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/')}>
                <IconHome size={22} />
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
              {currentOrgId && (currentRole === 'admin' || currentRole === 'moderator') && (
                <NotificationsBell />
              )}
              {currentOrgId && (currentRole === 'admin' || currentRole === 'moderator') && (
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
        </Box>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
