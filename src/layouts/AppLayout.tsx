import { useEffect } from 'react';
import { AppShell, Group, Text, Select } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { useOrg } from '@/shared/context/OrgContext';

export function AppLayout() {
  const { currentOrgId, setCurrentOrgId, organizations, currentOrg } = useOrg();

  useEffect(() => {
    if (currentOrg?.color) {
      document.body.style.setProperty('--org-color', currentOrg.color);
    }
  }, [currentOrg]);

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Select
            data={organizations.map((o) => ({ value: o.id, label: o.name }))}
            value={currentOrgId || null}
            onChange={(v) => v && setCurrentOrgId(v)}
            placeholder="Выберите организацию"
            w={320}
            clearable={false}
          />
          <Group>
            <Text size="sm">Пользователь</Text>
            <Text size="sm" c="dimmed" style={{ cursor: 'pointer' }}>
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
