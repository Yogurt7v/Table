import { Table, Text, Group, Stack, Button, ActionIcon, Box, Title, Alert } from '@mantine/core';
import { IconUserPlus, IconTrash, IconInfoCircle } from '@tabler/icons-react';
import { InlineRoleCell } from './InlineRoleCell';
import type { IUser, IOrganizationUser } from '@/shared/types';

interface UserAdminTableProps {
  users: IUser[] | undefined;
  orgUsers: IOrganizationUser[] | undefined;
  currentUserId: string | undefined;
  onAdd: () => void;
  onDelete: (user: { id: string; name: string }) => void;
}

export function UserAdminTable({
  users,
  orgUsers,
  currentUserId,
  onAdd,
  onDelete,
}: UserAdminTableProps) {
  return (
    <div>
      <Group justify="space-between" mb="sm">
        <Group>
          <IconUserPlus size={20} />
          <Title order={4}>Пользователи</Title>
        </Group>
        <Button leftSection={<IconUserPlus size={16} />} onClick={onAdd}>
          Добавить пользователя
        </Button>
      </Group>

      <details style={{ marginBottom: 'var(--mantine-spacing-sm)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
          Описание ролей
        </summary>
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mt="sm" pb={6}>
          <Stack gap={2}>
            <Text size="sm">
              <Text span c="red" fw={500}>
                Администратор
              </Text>{' '}
              — полный доступ
            </Text>
            <Text size="sm">
              <Text span c="blue" fw={500}>
                Модератор
              </Text>{' '}
              — Пользователь + удаление, перенос, история
            </Text>
            <Text size="sm">
              <Text span c="green" fw={500}>
                Пользователь
              </Text>{' '}
              — создание/редактирование счетов
            </Text>
            <Text size="sm">
              <Text span c="orange" fw={500}>
                Босс
              </Text>{' '}
              — отметка оплаты
            </Text>
            <Text size="sm">
              <Text span c="gray" fw={500}>
                Гость
              </Text>{' '}
              — только просмотр
            </Text>
          </Stack>
        </Alert>
      </details>

      <Box style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Имя</Table.Th>
              <Table.Th>Логин</Table.Th>
              <Table.Th>Роли в организациях</Table.Th>
              <Table.Th>Дата регистрации</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users?.map((user) => {
              const userOrgUsers = (orgUsers ?? []).filter((ou) => ou.user_id === user.id);

              return (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Text>{user.name || '—'}</Text>
                  </Table.Td>
                  <Table.Td>{user.login}</Table.Td>
                  <Table.Td>
                    <InlineRoleCell userId={user.id} assignments={userOrgUsers} />
                  </Table.Td>
                  <Table.Td>{new Date(user.created).toLocaleString('ru-RU')}</Table.Td>
                  <Table.Td>
                    {currentUserId !== user.id && (
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() =>
                          onDelete({ id: user.id, name: user.name || user.login })
                        }
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
    </div>
  );
}
