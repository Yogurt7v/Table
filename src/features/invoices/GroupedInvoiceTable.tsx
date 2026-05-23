import {
  Table,
  Text,
  Badge,
  Box,
  ActionIcon,
  Group,
  Tooltip,
  TextInput,
  Autocomplete,
  NumberInput,
  Menu,
} from '@mantine/core';
import {
  IconTrash,
  IconCheck,
  IconX,
  IconHistory,
  IconArrowRight,
  IconPencil,
  IconSettings,
} from '@tabler/icons-react';
import type { IInvoice } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { groupInvoicesByCounterparty, getInvoiceNumber } from '@/shared/utils/group-invoices';
import type { DraftInvoiceForm } from './invoice-field-access';

interface GroupedInvoiceTableProps {
  invoices: IInvoice[];
  isDraftOpen: boolean;
  draftForm?: DraftInvoiceForm;
  counterpartyResults?: string[];
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onDraftSave?: () => void;
  onDraftCancel?: () => void;
  onEdit: (invoice: IInvoice) => void;
  onDelete: (invoice: IInvoice) => void;
  onHistory: (invoice: IInvoice) => void;
  onMove: (invoice: IInvoice) => void;
  onTogglePaid: (invoice: IInvoice) => void;
  highlightedIds: string[];
  permissions: {
    canUpdate: boolean;
    canDelete: boolean;
    canViewHistory: boolean;
    canMove: boolean;
    canEditField?: (field: string) => boolean;
  };
}

export function GroupedInvoiceTable({
  invoices,
  isDraftOpen,
  draftForm,
  counterpartyResults,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onEdit,
  onDelete,
  onHistory,
  onMove,
  onTogglePaid,
  highlightedIds,
  permissions,
}: GroupedInvoiceTableProps) {
  const groups = groupInvoicesByCounterparty(invoices);

  if (groups.length === 0 && !isDraftOpen) {
    return (
      <Text c="dimmed" ta="center" py="md">
        Нет счетов за эту дату
      </Text>
    );
  }

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 50 }}>№</Table.Th>
            <Table.Th style={{ width: 180 }}>Контрагент</Table.Th>
            <Table.Th style={{ width: 200 }}>Назначение платежа</Table.Th>
            <Table.Th style={{ width: 150 }}>Договор</Table.Th>
            <Table.Th style={{ width: 120 }}>Счет</Table.Th>
            <Table.Th style={{ width: 100 }}>Сумма</Table.Th>
            <Table.Th style={{ width: 100 }}>Оплачено</Table.Th>
            <Table.Th style={{ width: 120 }}>Дата оплаты</Table.Th>
            <Table.Th style={{ width: 180 }}>Комментарий</Table.Th>
            <Table.Th style={{ width: 50 }}>Действия</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {groups.map((group) => {
            const counterpartyRowIndex = Math.ceil(group.invoices.length / 2);
            return group.invoices.map((invoice, idx) => {
              const invoiceNumber = getInvoiceNumber(groups, invoice.id);
              const showCounterparty = idx === counterpartyRowIndex - 1;
              const paid = invoice.paid;
              const isHighlighted = highlightedIds.includes(invoice.id);
              const rowStyle: React.CSSProperties = paid
                ? { backgroundColor: 'var(--mantine-color-yellow-1)' }
                : isHighlighted
                  ? { backgroundColor: 'var(--mantine-color-yellow-0)' }
                  : {};

              return (
                <Table.Tr key={invoice.id} style={rowStyle}>
                  <Table.Td>{invoiceNumber}</Table.Td>
                  <Table.Td>
                    {showCounterparty ? <Text fw={600}>{group.counterparty}</Text> : null}
                  </Table.Td>
                  <Table.Td>{invoice.purpose}</Table.Td>
                  <Table.Td>{invoice.contract_no || '—'}</Table.Td>
                  <Table.Td>{invoice.invoice_no}</Table.Td>
                  <Table.Td>{formatAmountRub(invoice.amount)}</Table.Td>
                  <Table.Td>
                    {permissions.canUpdate ? (
                      <Badge
                        color={paid ? 'green' : 'orange'}
                        onClick={() => onTogglePaid(invoice)}
                        style={{ cursor: 'pointer' }}
                      >
                        {paid ? 'Да' : 'Нет'}
                      </Badge>
                    ) : (
                      <Badge color={paid ? 'green' : 'orange'}>{paid ? 'Да' : 'Нет'}</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{invoice.paid_date || '—'}</Table.Td>
                  <Table.Td>{invoice.comment || '—'}</Table.Td>

                  {/* --- ЯЧЕЙКА ДЕЙСТВИЙ С ВЫПАДАЮЩИМ МЕНЮ --- */}
                  <Table.Td>
                    <Menu position="bottom-end" shadow="md" width={200} withinPortal>
                      <Menu.Target>
                        <Tooltip label="Действия">
                          <ActionIcon size="sm" variant="subtle" color="gray">
                            <IconSettings size={24} />
                          </ActionIcon>
                        </Tooltip>
                      </Menu.Target>

                      <Menu.Dropdown>
                        {permissions.canUpdate && (
                          <Menu.Item
                            leftSection={<IconPencil size={14} />}
                            onClick={() => onEdit(invoice)}
                          >
                            Редактировать
                          </Menu.Item>
                        )}
                        {permissions.canViewHistory && (
                          <Menu.Item
                            leftSection={<IconHistory size={14} />}
                            onClick={() => onHistory(invoice)}
                          >
                            История
                          </Menu.Item>
                        )}
                        {permissions.canMove && (
                          <Menu.Item
                            leftSection={<IconArrowRight size={14} />}
                            onClick={() => onMove(invoice)}
                          >
                            Перенести
                          </Menu.Item>
                        )}
                        {permissions.canDelete && (
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
                  </Table.Td>
                  {/* --- /ЯЧЕЙКА ДЕЙСТВИЙ --- */}
                </Table.Tr>
              );
            });
          })}
          {isDraftOpen && draftForm && (
            <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
              <Table.Td>—</Table.Td>
              <Table.Td>
                <Autocomplete
                  size="xs"
                  value={draftForm.counterparty}
                  onChange={(v) => onDraftChange?.('counterparty', v)}
                  data={counterpartyResults || []}
                  placeholder="Контрагент"
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  value={draftForm.purpose}
                  onChange={(e) => onDraftChange?.('purpose', e.currentTarget.value)}
                  placeholder="Назначение"
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  value={draftForm.contract_no}
                  onChange={(e) => onDraftChange?.('contract_no', e.currentTarget.value)}
                  placeholder="Договор"
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  value={draftForm.invoice_no}
                  onChange={(e) => onDraftChange?.('invoice_no', e.currentTarget.value)}
                  placeholder="Счет"
                />
              </Table.Td>
              <Table.Td>
                <NumberInput
                  size="xs"
                  value={draftForm.amount}
                  onChange={(v) => onDraftChange?.('amount', v ?? 0)}
                  thousandSeparator=" "
                  decimalSeparator=","
                  placeholder="Сумма"
                />
              </Table.Td>
              <Table.Td>
                <input
                  type="checkbox"
                  checked={draftForm.paid}
                  onChange={(e) => onDraftChange?.('paid', e.currentTarget.checked)}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  type="date"
                  value={draftForm.paid_date}
                  onChange={(e) => onDraftChange?.('paid_date', e.currentTarget.value)}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  value={draftForm.comment}
                  onChange={(e) => onDraftChange?.('comment', e.currentTarget.value)}
                  placeholder="Комментарий"
                />
              </Table.Td>
              <Table.Td>
                <Group gap={4} wrap="nowrap">
                  <Tooltip label="Сохранить">
                    <ActionIcon size="sm" color="green" variant="light" onClick={onDraftSave}>
                      <IconCheck size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Отмена">
                    <ActionIcon size="sm" color="gray" variant="subtle" onClick={onDraftCancel}>
                      <IconX size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
