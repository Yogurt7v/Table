import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Popover,
  Text,
} from '@mantine/core';
import { IconAdjustments, IconTrash } from '@tabler/icons-react';
import { useUpdateOrganizationUser } from '@/shared/hooks/useOrganizationUsers';
import type { IOrganizationUser } from '@/shared/types';
import type { Role } from '@/shared/types';
import { InlineRoleCellObjectPicker } from './InlineRoleCellObjectPicker';
import { InlineRoleCellInvoicePermissionsPopover } from './InlineRoleCellInvoicePermissionsPopover';
import { InlineRoleCellMailPermissionsPopover } from './InlineRoleCellMailPermissionsPopover';
import { InlineRoleCellDocumentPermissionsPopover } from './InlineRoleCellDocumentPermissionsPopover';
import { InlineRoleCellRoleSelect } from './InlineRoleCellRoleSelect';

interface InlineRoleCellAssignmentRowProps {
  assignment: IOrganizationUser;
  orgName: string;
  canManageMailPermissions: boolean;
  onDelete: () => void;
}

export function InlineRoleCellAssignmentRow({
  assignment,
  orgName,
  canManageMailPermissions,
  onDelete,
}: InlineRoleCellAssignmentRowProps) {
  const updateOrgUser = useUpdateOrganizationUser();
  const [objectsOpen, setObjectsOpen] = useState(false);
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);

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

      <InlineRoleCellRoleSelect
        role={assignment.role}
        onChange={handleRoleChange}
        disabled={updateOrgUser.isPending}
        orgName={orgName}
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
            <InlineRoleCellObjectPicker
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
        <>
          <InlineRoleCellInvoicePermissionsPopover
            assignment={assignment}
            canEdit={canManageMailPermissions}
            orgName={orgName}
          />

          <InlineRoleCellMailPermissionsPopover
            assignment={assignment}
            canEdit={canManageMailPermissions}
            orgName={orgName}
          />

          <InlineRoleCellDocumentPermissionsPopover
            assignment={assignment}
            canEdit={canManageMailPermissions}
            orgName={orgName}
          />
        </>
      )}

      <ActionIcon
        size="md"
        color="red"
        variant="subtle"
        aria-label={`Убрать доступ: ${orgName}`}
        onClick={onDelete}
      >
        <IconTrash size={18} />
      </ActionIcon>
    </Group>
  );
}
