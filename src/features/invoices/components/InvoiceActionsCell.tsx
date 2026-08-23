import { ActionIcon, Menu, Stack, Text } from '@mantine/core';
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
    <Menu position="bottom-end" shadow="md" width={230} withinPortal>
      <Menu.Target>
        <ActionIcon
          size={compact ? 'md' : 'sm'}
          ml={compact ? undefined : '15px'}
          variant="subtle"
          color="gray"
          aria-label="Действия со счётом"
        >
          <IconSettings size={compact ? 20 : 24} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconPencil size={14} />}
          disabled={!canUpdate}
          onClick={() => onEdit(invoice)}
        >
          {canUpdate ? (
            'Редактировать'
          ) : (
            <ItemHint label="Редактировать" reason="Нет прав на изменение" />
          )}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconHistory size={14} />}
          disabled={!canViewHistory}
          onClick={() => onHistory(invoice)}
        >
          {canViewHistory ? (
            'История'
          ) : (
            <ItemHint label="История" reason="Доступно модераторам и администраторам" />
          )}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconArrowRight size={14} />}
          disabled={!canMove}
          onClick={() => onMove(invoice)}
        >
          {canMove ? (
            'Перенести'
          ) : (
            <ItemHint label="Перенести" reason="Доступно модераторам и администраторам" />
          )}
        </Menu.Item>
        <Menu.Item leftSection={<IconFile size={14} />} onClick={() => onFiles?.(invoice)}>
          Файлы
        </Menu.Item>
        <Menu.Item
          leftSection={<IconCopy size={14} />}
          disabled={!canCreate}
          onClick={() => onCopy?.(invoice)}
        >
          {canCreate ? (
            'Копировать'
          ) : (
            <ItemHint label="Копировать" reason="Нет прав на создание счетов" />
          )}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconTrash size={14} />}
          color={canDelete ? 'red' : undefined}
          disabled={!canDelete}
          onClick={() => onDelete(invoice)}
        >
          {canDelete ? (
            'Удалить'
          ) : (
            <ItemHint label="Удалить" reason="Доступно модераторам и администраторам" />
          )}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function ItemHint({ label, reason }: { label: string; reason: string }) {
  return (
    <Stack gap={0}>
      <Text size="sm">{label}</Text>
      <Text size="xs" c="dimmed">
        {reason}
      </Text>
    </Stack>
  );
}
