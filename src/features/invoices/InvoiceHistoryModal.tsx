import { Modal, Stack, Text, Table, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getInvoiceHistory } from '@/api/collections';
import { formatAmountRub } from '@/shared/utils/format-currency';

const FIELD_LABELS: Record<string, string> = {
  counterparty: 'Контрагент',
  purpose: 'Назначение',
  contract_no: 'Номер договора',
  invoice_no: 'Номер счёта',
  amount: 'Сумма',
  paid: 'Оплачено',
  paid_date: 'Дата оплаты',
  comment: 'Комментарий',
  seq: '№',
};

interface InvoiceHistoryModalProps {
  invoiceId: string | null;
  invoiceLabel: string;
  opened: boolean;
  onClose: () => void;
}

export function InvoiceHistoryModal({
  invoiceId,
  invoiceLabel,
  opened,
  onClose,
}: InvoiceHistoryModalProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['invoice_history', invoiceId],
    queryFn: () => getInvoiceHistory(invoiceId!),
    enabled: opened && !!invoiceId,
  });

  return (
    <Modal opened={opened} onClose={onClose} title={`История: ${invoiceLabel}`} size="lg">
      {isLoading ? (
        <Loader size="sm" />
      ) : !history?.length ? (
        <Text c="dimmed">Изменений пока нет</Text>
      ) : (
        <Stack gap="md">
          {history.map((entry) => {
            const prev =
              typeof entry.previous_data === 'string'
                ? (JSON.parse(entry.previous_data) as Record<string, unknown>)
                : entry.previous_data;

            return (
              <Stack key={entry.id} gap={4}>
                <Text size="sm" fw={500}>
                  {dayjs(entry.changed_at).format('DD.MM.YYYY HH:mm')} — {entry.author}
                </Text>
                <Table withTableBorder striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Поле</Table.Th>
                      <Table.Th>Было</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {Object.entries(prev).map(([key, value]) => (
                      <Table.Tr key={key}>
                        <Table.Td>{FIELD_LABELS[key] ?? key}</Table.Td>
                        <Table.Td>{formatHistoryValue(key, value)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Modal>
  );
}

function formatHistoryValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (key === 'paid') return value ? 'Да' : 'Нет';
  if (key === 'amount') return formatAmountRub(Number(value));
  return String(value);
}
