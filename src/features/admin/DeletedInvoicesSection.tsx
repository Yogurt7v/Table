import { useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
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
  Pagination,
  ActionIcon,
} from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import {
  useDeletedInvoices,
  useRestoreInvoice,
} from '@/shared/hooks/useDeletedInvoices';
import { ARCHIVE_PAGE_SIZE } from '@/api/collections';
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
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const query = debouncedSearch.trim();

  const [page, setPage] = useState(1);
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setPage(1);
  }

  const { data, isLoading } = useDeletedInvoices(orgId, query, page, ARCHIVE_PAGE_SIZE);

  const invoices = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  if (totalPages > 0 && page > totalPages) {
    setPage(totalPages);
  }

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
          w={480}
          size="sm"
          leftSection={<IconSearch size={14} />}
          placeholder="Поиск по контрагенту, назначению, номеру"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          aria-label="Поиск в архиве"
          rightSection={
            search ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Очистить поиск"
                onClick={() => setSearch('')}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          rightSectionPointerEvents="all"
        />
      </Group>

      {isLoading && (
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      )}

      {!isLoading && invoices.length === 0 && (
        <Text c="dimmed" size="sm">
          {query ? 'Ничего не найдено' : 'Архив пуст'}
        </Text>
      )}

      {!isLoading && invoices.length > 0 && (
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
                      <Text lineClamp={1} title={inv.counterparty} aria-label={inv.counterparty}>{inv.counterparty || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text lineClamp={1} title={inv.purpose} aria-label={inv.purpose}>{inv.purpose || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      {inv.date ? dayjs(inv.date).format('DD.MM.YYYY') : '—'}
                    </Table.Td>
                    <Table.Td title={inv.invoice_no} aria-label={inv.invoice_no}>{inv.invoice_no || '—'}</Table.Td>
                    <Table.Td ta="right" aria-label={String(inv.amount)} title={String(inv.amount)}>
                      {formatAmountRub(inv.amount || 0)}
                    </Table.Td>
                    <Table.Td title={objectName} aria-label={objectName}>{objectName}</Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" aria-label={inv.deleted_by_name} title={inv.deleted_by_name}>
                        {inv.deleted_by_name || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" aria-label={inv.deleted_at ? dayjs(inv.deleted_at).format('DD.MM.YYYY HH:mm') : ''} title={inv.deleted_at ? dayjs(inv.deleted_at).format('DD.MM.YYYY HH:mm') : ''}>
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

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
        </Group>
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
