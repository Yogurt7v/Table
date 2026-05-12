import { AppShell, Group, Text, Select } from '@mantine/core';
import { Outlet } from 'react-router-dom';

const orgs = [
  { value: '1', label: 'ООО "Тестовая"' },
  { value: '2', label: 'ИП тестов' },
];

export function AppLayout() {
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Select
            data={orgs}
            placeholder="Выберите организацию"
            defaultValue="1"
            w={280}
            clearable={false}
          />
          <Group>
            <Text size="sm">Иван Иванов</Text>
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
