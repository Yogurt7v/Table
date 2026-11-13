import { useState } from 'react';
import { ActionIcon, Popover } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import { OrganizationUserMailPermissions } from '@/features/admin/OrganizationUserMailPermissions';

interface InlineRoleCellMailPermissionsPopoverProps {
  assignment: { can_view_mails?: boolean; id: string; organization_id: string };
  canEdit: boolean;
  orgName: string;
}

export function InlineRoleCellMailPermissionsPopover({
  assignment,
  canEdit,
  orgName,
}: InlineRoleCellMailPermissionsPopoverProps) {
  const [opened, setOpened] = useState(false);

  return (
    <Popover
      opened={opened}
      onClose={setOpened}
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
          onClick={() => setOpened((open) => !open)}
        >
          <IconMail size={24} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <OrganizationUserMailPermissions
          assignment={assignment}
          canEdit={canEdit}
          onSaved={() => setOpened(false)}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
