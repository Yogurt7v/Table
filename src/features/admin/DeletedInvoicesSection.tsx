import { useState } from 'react';
import {
  Table,
  Text,
  Group,
  TextInput,
  Box,
  Title,
  Stack,
  Button,
  Loader,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import dayjs from 'dayjs';
import {
  useDeletedInvoices,
  useSearchDeletedInvoices,
  useRestoreInvoice,
} from '@/shared/hooks/useDeletedInvoices';
import { DeletedInvoiceDetailModal } from './DeletedInvoiceDetailModal';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { formatAmountRub } from '@/shared/utils/format-currency';
import type { IDeletedInvoice } from '@/shared/types';

interface DeletedInvoicesSectionProps {
  orgId: string;
}

export function DeletedInvoicesSection({ orgId }: DeletedInvoicesSectionProps) {
  const role = useCurrentUserRole(orgId);
  const canRestore = role === 'admin' || role === 'moderator';

  const [search, setSearch] = useState('');
  const query = search.trim();

  const { data: allDeleted, isLoading: allLoading } = useDeletedInvoices(orgId);
  const { data: searchResults, isLoading: searchLoading } = useSearchDeletedInvoices(
    orgId,
    query,
  );

  const invoices = query ? searchResults : allDeleted;
  const isLoading = query ? searchLoading : allLoading;

  const [detailInvoice, setDetailInvoice] = useState<IDeletedInvoice | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<IDeletedInvoice | null>(null);
  const restore = useRestoreInvoice(orgId);

  return (
    <div>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs">
          <Title order={4}>Архив счетов</Title>
        </Group>
        <TextInput
          w={280}
          size="xs"
          leftSection={<IconSearch size={14} />}
          placeholder="Поиск по контрагенту, назначению, номеру"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          aria-label="Поиск в архиве"
        />
      </Group>

      {isLoading && (
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      )}

      {!isLoading && (!invoices || invoices.length === 0) && (
        <Text c="dimmed" size="sm">
          {query ? 'Ничего не найдено' : 'Архив пуст'}
        </Text>
      )}

      {!isLoading && invoices && invoices.length > 0 && (
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Контрагент</Table.Th>
                <Table.Th>Назначение</Table.Th>
                <Table.Th w={100}>Дата</Table.Th>
                <Table.Th w={130}>Номер</Table.Th>
                <Table.Th w={120} ta="right">
                  Сумма
                </Table.Th>
                <Table.Th>Объект</Table.Th>
                <Table.Th w={140}>Удалил</Table.Th>
                <Table.Th w={140}>Удалён</Table.Th>
                <Table.Th w={200} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invoices.map((inv) => {
                const objectName = inv.expand?.accounting_object_id?.name ?? '—';
                return (
                  <Table.Tr key={inv.id}>
                    <Table.Td>
                      <Text lineClamp={1}>{inv.counterparty || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text lineClamp={1}>{inv.purpose || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      {inv.date ? dayjs(inv.date).format('DD.MM.YYYY') : '—'}
                    </Table.Td>
                    <Table.Td>{inv.invoice_no || '—'}</Table.Td>
                    <Table.Td ta="right">
                      {formatAmountRub(inv.amount || 0)}
                    </Table.Td>
                    <Table.Td>{objectName}</Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {inv.deleted_by_name || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {inv.deleted_at
                          ? dayjs(inv.deleted_at).format('DD.MM.YYYY HH:mm')
                          : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} justify="flex-end" wrap="nowrap">
                        <Button
                          variant="subtle"
                          size="compact-sm"
                          onClick={() => setDetailInvoice(inv)}
                        >
                          Просмотреть
                        </Button>
                        {canRestore && (
                          <Button
                            variant="light"
                            color="green"
                            size="compact-sm"
                            onClick={() => setRestoreTarget(inv)}
                          >
                            Восстановить
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      <DeletedInvoiceDetailModal
        invoice={detailInvoice}
        opened={!!detailInvoice}
        onClose={() => setDetailInvoice(null)}
      />

      <ConfirmModal
        opened={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => {
          if (restoreTarget) {
            restore.mutate(restoreTarget.id);
          }
          setRestoreTarget(null);
        }}
        title="Восстановление счёта"
        confirmLabel="Восстановить"
        color="green"
        loading={restore.isPending}
        message={
          <Stack gap={4}>
            <Text size="sm">
              Восстановить счёт «{restoreTarget?.counterparty || 'Без контрагента'}»?
            </Text>
            <Text size="xs" c="dimmed">
              Счёт будет возвращён в активные с новым порядковым номером.
            </Text>
          </Stack>
        }
      />
    </div>
  );
}
