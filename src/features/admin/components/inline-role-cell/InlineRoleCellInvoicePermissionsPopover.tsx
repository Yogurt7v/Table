import { useState } from 'react';
import { ActionIcon, Popover } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { OrganizationUserInvoicePermissions } from '@/features/admin/OrganizationUserInvoicePermissions';

interface InlineRoleCellInvoicePermissionsPopoverProps {
  assignment: { can_view_invoices?: boolean; id: string; organization_id: string };
  canEdit: boolean;
  orgName: string;
}

export function InlineRoleCellInvoicePermissionsPopover({
  assignment,
  canEdit,
  orgName,
}: InlineRoleCellInvoicePermissionsPopoverProps) {
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
          color={assignment.can_view_invoices === true ? 'blue' : 'gray'}
          aria-label={`Права на счета: ${orgName}`}
          onClick={() => setOpened((open) => !open)}
        >
          <IconFileText size={24} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <OrganizationUserInvoicePermissions
          assignment={assignment}
          canEdit={canEdit}
          onClose={() => setOpened(false)}
          onSaved={() => setOpened(false)}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
