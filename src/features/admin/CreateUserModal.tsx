import { useState } from 'react';
import {
  Modal,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Group,
  Select,
  ActionIcon,
} from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { createUser } from '@/api/collections';
import { createOrganizationUser } from '@/api/collections';
import { useOrg } from '@/shared/context/OrgContext';
import type { IOrganizationUser } from '@/shared/types';

interface CreateUserModalProps {
  opened: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS: { value: IOrganizationUser['role']; label: string }[] = [
  { value: 'boss', label: 'Босс' },
  { value: 'admin', label: 'Администратор' },
  { value: 'moderator', label: 'Модератор' },
  { value: 'user', label: 'Пользователь' },
  { value: 'guest', label: 'Гость' },
];

interface Assignment {
  orgId: string;
  role: IOrganizationUser['role'];
}

export function CreateUserModal({ opened, onClose }: CreateUserModalProps) {
  const [login, setLogin] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const { organizations } = useOrg();
  const qc = useQueryClient();

  const usedOrgIds = assignments.map((a) => a.orgId);
  const availableOrgs = organizations.filter((o) => !usedOrgIds.includes(o.id));

  const addAssignment = () => {
    if (availableOrgs.length === 0) return;
    setAssignments([...assignments, { orgId: availableOrgs[0]!.id, role: 'guest' }]);
  };

  const updateAssignment = (index: number, field: keyof Assignment, value: string) => {
    const next = [...assignments];
    if (field === 'orgId') {
      next[index] = { ...next[index], orgId: value } as Assignment;
    } else {
      next[index] = { ...next[index], role: value as IOrganizationUser['role'] } as Assignment;
    }
    setAssignments(next);
  };

  const removeAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (assignments.length === 0) {
      setError('Добавьте хотя бы одну организацию');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }

    setLoading(true);
    try {
      const user = await createUser(login, password, name);
      await Promise.all(assignments.map((a) => createOrganizationUser(user.id, a.orgId, a.role)));
      qc.resetQueries({ queryKey: ['users'] });
      qc.resetQueries({ queryKey: ['organization_users'] });
      setLogin('');
      setName('');
      setPassword('');
      setAssignments([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Добавить пользователя" size="lg">
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Имя"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Логин"
            value={login}
            onChange={(e) => setLogin(e.currentTarget.value)}
            required
          />
          <PasswordInput
            label="Пароль"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
          />

          <Text fw={500} size="sm" mt="sm">
            Назначение в организации
          </Text>

          {assignments.map((a, i) => (
            <Group key={i} gap="xs" align="end">
              <Select
                label="Организация"
                data={organizations.map((o) => ({
                  value: o.id,
                  label: o.name,
                  disabled: usedOrgIds.includes(o.id) && o.id !== a.orgId,
                }))}
                value={a.orgId}
                onChange={(v) => v && updateAssignment(i, 'orgId', v)}
                size="xs"
                w={220}
                required
              />
              <Select
                label="Роль"
                data={ROLE_OPTIONS}
                value={a.role}
                onChange={(v) => v && updateAssignment(i, 'role', v)}
                size="xs"
                w={160}
                required
              />
              <ActionIcon color="red" variant="subtle" onClick={() => removeAssignment(i)}>
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}

          {availableOrgs.length > 0 && (
            <Button
              size="xs"
              variant="outline"
              leftSection={<IconPlus size={14} />}
              onClick={addAssignment}
            >
              Добавить организацию
            </Button>
          )}

          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}

          <Button type="submit" loading={loading} fullWidth>
            Создать пользователя
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
