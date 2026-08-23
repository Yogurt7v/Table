import { Table, Text, Title, Group, Stack, Button, ActionIcon, Box } from '@mantine/core';
import { IconBuilding, IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';
import type { IOrganization, IBankAccount, IAccountingObject } from '@/shared/types';

interface OrganizationAdminTableProps {
  organizations: IOrganization[];
  accountsByOrg: Record<string, IBankAccount[]>;
  objectsByOrg: Record<string, IAccountingObject[]>;
  colorName: Record<string, string>;
  onAdd: () => void;
  onEdit: (orgId: string) => void;
  onDelete: (org: IOrganization) => void;
}

export function OrganizationAdminTable({
  organizations,
  accountsByOrg,
  objectsByOrg,
  colorName,
  onAdd,
  onEdit,
  onDelete,
}: OrganizationAdminTableProps) {
  return (
    <div>
      <Group justify="space-between" mb="sm">
        <Group>
          <IconBuilding size={20} />
          <Title order={4}>Организации</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={onAdd}>
          Добавить организацию
        </Button>
      </Group>

      <Box style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover withTableBorder mb="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th>Счета</Table.Th>
              <Table.Th>Объекты</Table.Th>
              <Table.Th>Цвет</Table.Th>
              <Table.Th w={100} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {organizations.map((org) => (
              <Table.Tr key={org.id}>
                <Table.Td>
                  <Text>{org.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    {(accountsByOrg[org.id] ?? []).length === 0 ? (
                      <Text size="xs" c="dimmed">
                        Нет счетов
                      </Text>
                    ) : (
                      (accountsByOrg[org.id] ?? []).map((acc) => (
                        <Text key={acc.id} size="sm">
                          {acc.account_number}
                        </Text>
                      ))
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    {(objectsByOrg[org.id] ?? []).length === 0 ? (
                      <Text size="xs" c="dimmed">
                        Нет объектов
                      </Text>
                    ) : (
                      (objectsByOrg[org.id] ?? []).map((obj) => (
                        <Text key={obj.id} size="sm">
                          {obj.name}
                        </Text>
                      ))
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        backgroundColor: org.color,
                      }}
                    />
                    <Text size="sm">{colorName[org.color] || org.color}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      color="blue"
                      variant="subtle"
                      size="lg"
                      aria-label={`Редактировать «${org.name}»`}
                      onClick={() => onEdit(org.id)}
                    >
                      <IconPencil size={22} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      size="lg"
                      aria-label={`Удалить организацию «${org.name}»`}
                      onClick={() => onDelete(org)}
                    >
                      <IconTrash size={22} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </div>
  );
}
