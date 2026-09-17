import { Modal, Tabs, Table, Text, Group, Stack, Anchor, Loader, Box } from '@mantine/core';
import { IconPaperclip } from '@tabler/icons-react';
import dayjs from 'dayjs';
import {
  useDeletedInvoiceHistory,
  useDeletedInvoiceFiles,
} from '@/shared/hooks/useDeletedInvoices';
import { getDeletedInvoiceFileUrl } from '@/api/collections';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { getUserDisplayName } from '@/shared/utils/user-display-name';
import { useUserMap } from '@/shared/hooks/useUserMap';
import type { IDeletedInvoice } from '@/shared/types';

interface DeletedInvoiceDetailModalProps {
  invoice: IDeletedInvoice | null;
  opened: boolean;
  onClose: () => void;
}

export function DeletedInvoiceDetailModal({
  invoice,
  opened,
  onClose,
}: DeletedInvoiceDetailModalProps) {
  if (!invoice) return null;

  const label = `${invoice.counterparty || 'Без контрагента'} · ${formatAmountRub(invoice.amount || 0)}`;

  return (
    <Modal opened={opened} onClose={onClose} title={label} size="lg">
      <Tabs defaultValue="details">
        <Tabs.List>
          <Tabs.Tab value="details">Данные</Tabs.Tab>
          <Tabs.Tab value="history">История</Tabs.Tab>
          <Tabs.Tab value="files">Файлы</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <DetailsTab invoice={invoice} />
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <HistoryTab invoiceId={invoice.id} />
        </Tabs.Panel>

        <Tabs.Panel value="files" pt="md">
          <FilesTab invoiceId={invoice.id} />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

function DetailsTab({ invoice }: { invoice: IDeletedInvoice }) {
  const userMap = useUserMap();
  const objectName = invoice.expand?.accounting_object_id?.name ?? '—';

  return (
    <Stack gap="xs">
      <Row label="Номер" value={invoice.seq ? String(invoice.seq) : '—'} />
      <Row label="Дата" value={invoice.date ? dayjs(invoice.date).format('DD.MM.YYYY') : '—'} />
      <Row label="Контрагент"    value={invoice.counterparty || '—'} />
      <Row label="Назначение" value={invoice.purpose || '—'} />
      <Row label="Договор" value={invoice.contract_no || '—'} />
      <Row label="Номер счёта" value={invoice.invoice_no || '—'} />
      <Row label="Сумма" value={formatAmountRub(invoice.amount || 0)} />
      <Row
        label="Оплачен"
        value={invoice.paid ? 'Да' : 'Нет'}
      />
      <Row label="Объект" value={objectName} />
      {invoice.paid && invoice.paid_date && (
        <Row label="Дата оплаты" value={dayjs(invoice.paid_date).format('DD.MM.YYYY')} />
      )}
      {invoice.comment && <Row label="Комментарий" value={invoice.comment} />}

      <Row label="Инициатор" value={getUserDisplayName(userMap.get(invoice.created_by))} />
      <Box
        mt="sm"
        p="sm"
        style={{
          borderRadius: 6,
          background: 'var(--mantine-color-red-0)',
          border: '1px solid var(--mantine-color-red-2)',
        }}
      >
        <Stack gap={4}>
          <Text size="xs" fw={600} c="red">
            Удалён
          </Text>
          <Text size="xs" c="dimmed">
            Кто:{' '}
            <Text component="span" c="dark.6">
              {invoice.deleted_by_name || 'Неизвестно'}
            </Text>
          </Text>
          <Text size="xs" c="dimmed">
            Когда:{' '}
            <Text component="span" c="dark.6">
              {invoice.deleted_at
                ? dayjs(invoice.deleted_at).format('DD.MM.YYYY HH:mm')
                : '—'}
            </Text>
          </Text>
        </Stack>
      </Box>
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Text size="sm" c="dimmed" w={130}>
        {label}
      </Text>
      <Text size="md">{value}</Text>
    </Group>
  );
}

function HistoryTab({ invoiceId }: { invoiceId: string }) {
  const { data: history, isLoading } = useDeletedInvoiceHistory(invoiceId);

  if (isLoading) return <Loader size="sm" />;

  if (!history || history.length === 0) {
    return <Text c="dimmed" size="sm">История пуста</Text>;
  }

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Дата</Table.Th>
            <Table.Th>Автор</Table.Th>
            <Table.Th>Тип</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {history.map((h) => (
            <Table.Tr key={h.id}>
              <Table.Td>{dayjs(h.changed_at).format('DD.MM.YYYY HH:mm')}</Table.Td>
              <Table.Td>{h.author}</Table.Td>
              <Table.Td>{formatHistoryType(h.type)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

function FilesTab({ invoiceId }: { invoiceId: string }) {
  const { data: files, isLoading } = useDeletedInvoiceFiles(invoiceId);

  if (isLoading) return <Loader size="sm" />;

  if (!files || files.length === 0) {
    return <Text c="dimmed" size="sm">Нет файлов</Text>;
  }

  return (
    <Stack gap="xs">
      {files.map((f) => {
        const url = getDeletedInvoiceFileUrl(f);
        return (
          <Group key={f.id} gap="xs">
            <IconPaperclip size={14} />
            <Anchor
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
            >
              {f.name}
            </Anchor>
          </Group>
        );
      })}
    </Stack>
  );
}

function formatHistoryType(type: string): string {
  switch (type) {
    case 'mark_created':
      return 'Отметка создана';
    case 'mark_deleted':
      return 'Отметка удалена';
    case 'copy_created':
      return 'Частично оплачен';
    case 'file_added':
      return 'Файл добавлен';
    case 'file_removed':
      return 'Файл удалён';
    case 'invoice_deleted':
      return 'Счёт удалён';
    case 'invoice_restored':
      return 'Счёт восстановлен из архива';
    default:
      return type || 'Изменение';
  }
}
