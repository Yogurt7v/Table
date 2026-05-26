import { Modal, Text, Timeline, Loader } from '@mantine/core';
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
        <>
          <Text size="xs" c="dimmed" mb="sm">
            Показаны старые значения изменённых полей
          </Text>
          <Timeline active={history.length - 1} bulletSize={28} lineWidth={2}>
          {history.map((entry) => {
            const prev =
              typeof entry.previous_data === 'string'
                ? (JSON.parse(entry.previous_data) as Record<string, unknown>)
                : entry.previous_data;

            return (
              <Timeline.Item
                key={entry.id}
                title={dayjs(entry.changed_at).format('DD.MM.YYYY HH:mm')}
              >
                <Text c="dimmed" size="sm" mb="xs">
                  {entry.author}
                </Text>

                {Object.entries(prev).map(([key, value]) => (
                  <Text key={key} size="sm">
                    <Text component="span" c="dimmed">
                      {FIELD_LABELS[key] ?? key}:{' '}
                    </Text>
                    {formatHistoryValue(key, value)}
                  </Text>
                ))}
              </Timeline.Item>
            );
          })}
        </Timeline>
        </>
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
