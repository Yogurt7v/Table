import { useState } from 'react';
import { ActionIcon, Popover } from '@mantine/core';
import { IconFile } from '@tabler/icons-react';
import { OrganizationUserDocumentPermissions } from '@/features/admin/OrganizationUserDocumentPermissions';
import type { IOrganizationUser } from '@/shared/types';

interface InlineRoleCellDocumentPermissionsPopoverProps {
  assignment: IOrganizationUser;
  canEdit: boolean;
  orgName: string;
}

export function InlineRoleCellDocumentPermissionsPopover({
  assignment,
  canEdit,
  orgName,
}: InlineRoleCellDocumentPermissionsPopoverProps) {
  const [opened, setOpened] = useState(false);

  return (
    <Popover
      opened={opened}
      onClose={() => setOpened(false)}
      closeOnClickOutside={false}
      width="min(460px, calc(100vw - 24px))"
      position="bottom-end"
    >
      <Popover.Target>
        <ActionIcon
          size="sm"
          variant="subtle"
          color={assignment.can_view_documents === true ? 'blue' : 'gray'}
          aria-label={`Права на документы: ${orgName}`}
          onClick={() => setOpened((open) => !open)}
        >
          <IconFile size={24} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <OrganizationUserDocumentPermissions
          assignment={assignment}
          canEdit={canEdit}
          onClose={() => setOpened(false)}
          onSaved={() => setOpened(false)}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
