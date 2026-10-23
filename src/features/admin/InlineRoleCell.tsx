import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Checkbox,
  CheckboxGroup,
  Group,
  Loader,
  Popover,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAdjustments, IconMail, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import {
  useCreateOrganizationUser,
  useDeleteOrganizationUser,
  useUpdateOrganizationUser,
} from '@/shared/hooks/useOrganizationUsers';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { getAccountingObjects } from '@/api/collections';
import { useOrg } from '@/shared/context/OrgContext';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { OrganizationUserMailPermissions } from './OrganizationUserMailPermissions';
import type { IOrganizationUser } from '@/shared/types';

type Role = IOrganizationUser['role'];

const ROLE_COLORS: Record<Role, string> = {
  admin: 'red',
  moderator: 'blue',
  user: 'green',
  boss: 'yellow',
  guest: 'gray',
};

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Администратор',
  moderator: 'Модератор',
  user: 'Пользователь',
  boss: 'Босс',
  guest: 'Гость',
};

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

function roleInputStyles(role: Role) {
  return { input: { backgroundColor: `var(--mantine-color-${ROLE_COLORS[role]}-0)` } };
}

interface InlineRoleCellProps {
  userId: string;
  assignments: IOrganizationUser[];
  /** Reuses AdminPage's gate (admin and moderator); mail flags are never derived from role. */
  canManageMailPermissions: boolean;
}

function ObjectPicker({
  orgId,
  selected,
  onChange,
}: {
  orgId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: objects, isLoading } = useAccountingObjects(orgId);
  const [search, setSearch] = useState('');

  if (isLoading) return <Loader size="xs" />;

  if (!objects || objects.length === 0) {
    return (
      <Text size="xs" c="dimmed" fs="italic">
        У организации нет объектов
      </Text>
    );
  }

  const query = search.trim().toLowerCase();
  const filtered = query
    ? objects.filter((object) => object.name.toLowerCase().includes(query))
    : objects;
  const selectedIds = new Set(selected);
  const allFilteredSelected = filtered.every((object) => selectedIds.has(object.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map((object) => object.id));
      onChange(selected.filter((id) => !filteredIds.has(id)));
      return;
    }

    const next = new Set(selected);
    for (const object of filtered) next.add(object.id);
    onChange(Array.from(next));
  };

  return (
    <Stack gap="xs" w={300}>
      <TextInput
        size="xs"
        placeholder="Поиск объекта"
        aria-label="Поиск объекта"
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed">
          Выбрано {selected.length} из {objects.length}
        </Text>
        <Button size="compact-xs" variant="subtle" onClick={toggleAll}>
          {allFilteredSelected ? 'Снять все' : 'Выбрать все'}
        </Button>
      </Group>
      <ScrollArea.Autosize mah={240} type="auto">
        <CheckboxGroup value={selected} onChange={onChange}>
          <Stack gap={4}>
            {filtered.map((object) => (
              <Checkbox key={object.id} value={object.id} label={object.name} size="xs" />
            ))}
          </Stack>
        </CheckboxGroup>
      </ScrollArea.Autosize>
      {filtered.length === 0 && (
        <Text size="xs" c="dimmed">
          Ничего не найдено
        </Text>
      )}
    </Stack>
  );
}

interface AssignmentRowProps {
  assignment: IOrganizationUser;
  orgName: string;
  canManageMailPermissions: boolean;
  onDelete: () => void;
}

function AssignmentRow({
  assignment,
  orgName,
  canManageMailPermissions,
  onDelete,
}: AssignmentRowProps) {
  const updateOrgUser = useUpdateOrganizationUser();
  const [objectsOpen, setObjectsOpen] = useState(false);
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);
  const [mailOpen, setMailOpen] = useState(false);

  const isAdmin = assignment.role === 'admin';
  const selectedCount = assignment.objects?.length ?? 0;

  const handleRoleChange = async (value: string | null) => {
    if (!value || value === assignment.role) return;

    try {
      await updateOrgUser.mutateAsync({ id: assignment.id, data: { role: value as Role } });
    } catch {
      /* тост об ошибке показывает onError в useUpdateOrganizationUser */
    }
  };

  const handleObjectsSave = async () => {
    try {
      await updateOrgUser.mutateAsync({ id: assignment.id, data: { objects: selectedObjects } });
      setObjectsOpen(false);
    } catch {
      /* тост об ошибке показывает onError в useUpdateOrganizationUser */
    }
  };

  return (
    <Group gap="xs" wrap="nowrap" py={2}>
      <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
        {orgName}
      </Text>

      <Select
        size="xs"
        w={170}
        data={ROLE_OPTIONS}
        value={assignment.role}
        onChange={handleRoleChange}
        allowDeselect={false}
        aria-label={`Роль: ${orgName}`}
        styles={roleInputStyles(assignment.role)}
        disabled={updateOrgUser.isPending}
      />

      {isAdmin ? (
        <Text size="xs" c="dimmed" w={110} ta="center">
          Все объекты
        </Text>
      ) : (
        <Popover
          opened={objectsOpen}
          onClose={() => setObjectsOpen(false)}
          closeOnClickOutside={false}
          position="bottom-end"
        >
          <Popover.Target>
            <Button
              size="compact-xs"
              variant="subtle"
              color={selectedCount > 0 ? 'blue' : 'red'}
              leftSection={<IconAdjustments size={14} />}
              onClick={() => {
                setSelectedObjects(assignment.objects ?? []);
                setObjectsOpen((open) => !open);
              }}
            >
              Объекты: {selectedCount}
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <ObjectPicker
              orgId={assignment.organization_id}
              selected={selectedObjects}
              onChange={setSelectedObjects}
            />
            <Group justify="flex-end" mt="xs">
              <Button size="compact-xs" variant="light" onClick={() => setObjectsOpen(false)}>
                Отмена
              </Button>
              <Button size="compact-xs" onClick={handleObjectsSave} loading={updateOrgUser.isPending}>
                Сохранить
              </Button>
            </Group>
          </Popover.Dropdown>
        </Popover>
      )}

      {canManageMailPermissions && (
        <Popover
          opened={mailOpen}
          onClose={() => setMailOpen(false)}
          closeOnClickOutside={false}
          width="min(460px, calc(100vw - 24px))"
          position="bottom-end"
        >
          <Popover.Target>
            <ActionIcon
              size="sm"
              variant="subtle"
              color={assignment.can_view_mails === true ? 'blue' : 'gray'}
              aria-label={`Почтовые права: ${orgName}`}
              onClick={() => setMailOpen((open) => !open)}
            >
              <IconMail size={24} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <OrganizationUserMailPermissions
              assignment={assignment}
              canEdit={canManageMailPermissions}
              onSaved={() => setMailOpen(false)}
            />
          </Popover.Dropdown>
        </Popover>
      )}

      <ActionIcon size="md" color="red" variant="subtle" aria-label={`Убрать доступ: ${orgName}`} onClick={onDelete}>
        <IconTrash size={18} />
      </ActionIcon>
    </Group>
  );
}

export function InlineRoleCell({
  userId,
  assignments,
  canManageMailPermissions,
}: InlineRoleCellProps) {
  const createOrgUser = useCreateOrganizationUser();
  const deleteOrgUser = useDeleteOrganizationUser();
  const { organizations } = useOrg();
  const [showForm, setShowForm] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('guest');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; orgName: string } | null>(null);

  const availableOrgs = organizations.filter(
    (organization) => !assignments.some((a) => a.organization_id === organization.id),
  );

  const handleAdd = async () => {
    if (!selectedOrg) return;

    try {
      const objectIds =
        selectedRole === 'admin'
          ? undefined
          : (await getAccountingObjects(selectedOrg)).map((object) => object.id);

      await createOrgUser.mutateAsync({
        userId,
        organizationId: selectedOrg,
        role: selectedRole,
        objectIds,
      });
      setSelectedOrg(null);
      setSelectedRole('guest');
    } catch {
      /* тост об ошибке показывает onError в useCreateOrganizationUser */
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await deleteOrgUser.mutateAsync(id);
    } catch {
      /* тост об ошибке показывает onError в useDeleteOrganizationUser */
    }
  };

  return (
    <>
      {assignments.length === 0 && !availableOrgs.length ? (
        <Text size="sm" c="dimmed">
          Нет ролей
        </Text>
      ) : (
        <Stack gap={2}>
          {assignments.map((assignment) => {
            const orgName =
              organizations.find((organization) => organization.id === assignment.organization_id)
                ?.name ?? assignment.organization_id;

            return (
              <AssignmentRow
                key={assignment.id}
                assignment={assignment}
                orgName={orgName}
                canManageMailPermissions={canManageMailPermissions}
                onDelete={() => setDeleteTarget({ id: assignment.id, orgName })}
              />
            );
          })}
        </Stack>
      )}

      {showForm && (
        <Group gap={6} wrap="nowrap" mt="sm">
          <Select
            data={availableOrgs.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
            value={selectedOrg}
            onChange={setSelectedOrg}
            placeholder="Организация"
            aria-label="Новая организация"
            size="xs"
            style={{ flex: 1, minWidth: 0 }}
            comboboxProps={{ withinPortal: false }}
          />
          <Select
            data={ROLE_OPTIONS}
            value={selectedRole}
            onChange={(value) => value && setSelectedRole(value as Role)}
            aria-label="Новая роль"
            size="xs"
            w={170}
            comboboxProps={{ withinPortal: false }}
          />
          <ActionIcon
            size="sm"
            color="green"
            variant="light"
            aria-label="Добавить назначение"
            onClick={async () => {
              await handleAdd();
              setShowForm(false);
            }}
            disabled={!selectedOrg}
            loading={createOrgUser.isPending}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </Group>
      )}

      {availableOrgs.length > 0 && !showForm && (
        <Button
          size="compact-sm"
          variant="subtle"
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowForm(true)}
          fullWidth
          mt="sm"
        >
          Добавить
        </Button>
      )}

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            handleRemove(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        title="Удаление роли"
        message={`Убрать доступ «${deleteTarget?.orgName ?? ''}»?`}
      />
    </>
  );
}
