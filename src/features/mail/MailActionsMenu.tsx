import { ActionIcon, Menu } from '@mantine/core';
import { IconHistory, IconPencil, IconSettings, IconTrash } from '@tabler/icons-react';
import type { MailType } from '@/shared/types';
import type { MailPermissions } from './mail-field-access';

interface MailActionsMenuProps {
  mailId: string;
  mailType: MailType;
  compact?: boolean;
  permissions: MailPermissions;
  onEdit: (mailId: string) => void;
  onDelete: (mailId: string) => void;
  onHistory: (mailId: string) => void;
}

/**
 * Меню действий строки — та же форма, что `InvoiceActionsCell`: одна иконка
 * настроек и выпадающее меню, из которого у конкретного пользователя остаются
 * только разрешённые пункты. Запрещённого действия здесь нет вовсе, а не
 * «задизейбленного» — так же, как в реестре счетов.
 */
export function MailActionsMenu({
  mailId,
  mailType,
  compact,
  permissions,
  onEdit,
  onDelete,
  onHistory,
}: MailActionsMenuProps) {
  const canEdit =
    mailType === 'incoming' ? permissions.canEditIncoming : permissions.canEditOutgoing;
  const canDelete =
    mailType === 'incoming' ? permissions.canDeleteIncoming : permissions.canDeleteOutgoing;

  return (
    <Menu position="bottom-end" shadow="md" width={210} withinPortal>
      <Menu.Target>
        <ActionIcon
          size={compact ? 'md' : 'sm'}
          variant="subtle"
          color="gray"
          aria-label="Действия с письмом"
        >
          <IconSettings size={compact ? 20 : 18} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        {canEdit && (
          <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => onEdit(mailId)}>
            Редактировать
          </Menu.Item>
        )}
        {permissions.canViewHistory && (
          <Menu.Item leftSection={<IconHistory size={14} />} onClick={() => onHistory(mailId)}>
            История
          </Menu.Item>
        )}
        {canDelete && (
          <Menu.Item
            leftSection={<IconTrash size={14} />}
            color="red"
            onClick={() => onDelete(mailId)}
          >
            Удалить
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
