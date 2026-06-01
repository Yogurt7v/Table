import { ActionIcon, Menu } from '@mantine/core';
import {
  IconSettings,
  IconPencil,
  IconHistory,
  IconArrowRight,
  IconFile,
  IconCopy,
  IconTrash,
} from '@tabler/icons-react';
import type { IInvoice } from '@/shared/types';

interface InvoiceActionsCellProps {
  invoice: IInvoice;
  canUpdate: boolean;
  canDelete: boolean;
  canViewHistory: boolean;
  canMove: boolean;
  canCreate: boolean;
  onEdit: (invoice: IInvoice) => void;
  onDelete: (invoice: IInvoice) => void;
  onHistory: (invoice: IInvoice) => void;
  onMove: (invoice: IInvoice) => void;
  onFiles?: (invoice: IInvoice) => void;
  onCopy?: (invoice: IInvoice) => void;
  compact?: boolean;
}

export function InvoiceActionsCell({
  invoice,
  canUpdate,
  canDelete,
  canViewHistory,
  canMove,
  canCreate,
  onEdit,
  onDelete,
  onHistory,
  onMove,
  onFiles,
  onCopy,
  compact,
}: InvoiceActionsCellProps) {
  return (
    <Menu position="bottom-end" shadow="md" width={200} withinPortal>
      <Menu.Target>
        <ActionIcon
          size={compact ? 'md' : 'sm'}
          ml={compact ? undefined : '15px'}
          variant="subtle"
          color="gray"
        >
          <IconSettings size={compact ? 20 : 24} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        {canUpdate && (
          <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => onEdit(invoice)}>
            Редактировать
          </Menu.Item>
        )}
        {canViewHistory && (
          <Menu.Item leftSection={<IconHistory size={14} />} onClick={() => onHistory(invoice)}>
            История
          </Menu.Item>
        )}
        {canMove && (
          <Menu.Item leftSection={<IconArrowRight size={14} />} onClick={() => onMove(invoice)}>
            Перенести
          </Menu.Item>
        )}
        <Menu.Item leftSection={<IconFile size={14} />} onClick={() => onFiles?.(invoice)}>
          Файлы
        </Menu.Item>
        {canCreate && (
          <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => onCopy?.(invoice)}>
            Копировать
          </Menu.Item>
        )}
        {canDelete && (
          <Menu.Item
            leftSection={<IconTrash size={14} />}
            color="red"
            onClick={() => onDelete(invoice)}
          >
            Удалить
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
