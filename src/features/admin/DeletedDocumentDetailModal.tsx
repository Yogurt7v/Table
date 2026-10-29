import { Box, Group, Modal, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { formatAmountRub } from '@/shared/utils/format-currency';
import type { IDocument } from '@/shared/types';

interface DeletedDocumentDetailModalProps {
  document: IDocument | null;
  objectName: string;
  opened: boolean;
  onClose: () => void;
}

export function DeletedDocumentDetailModal({
  document,
  objectName,
  opened,
  onClose,
}: DeletedDocumentDetailModalProps) {
  if (!document) return null;

  const label = `Документ №${document.seq} · ${document.counterparty || 'Без контрагента'}`;

  return (
    <Modal opened={opened} onClose={onClose} title={label} size="lg">
      <Stack gap="xs">
        <Row label="Номер" value={String(document.seq)} />
        <Row
          label="Дата оплаты"
          value={
            document.payment_date ? dayjs(document.payment_date).format('DD.MM.YYYY') : '—'
          }
        />
        <Row label="Объект" value={objectName || '—'} />
        <Row label="Контрагент" value={document.counterparty || '—'} />
        <Row label="Назначение" value={document.purpose || '—'} />
        <Row label="Договор" value={document.contract_no || '—'} />
        <Row label="Счёт №" value={document.invoice_no || '—'} />
        <Row label="Сумма" value={document.amount ? formatAmountRub(document.amount) : '—'} />
        <Row label="Ответственный" value={document.responsible_name || '—'} />
        <Row label="Автор" value={document.created_by_name || '—'} />
        <Row label="Предоставлен" value={document.provided ? 'Да' : 'Нет'} />
        <Row label="Подтверждён" value={document.confirmed ? 'Да' : 'Нет'} />

        <Box mt="sm" p="sm" style={deletionBoxStyle}>
          <Stack gap={4}>
            <Text size="xs" fw={600} c="red">
              Удалён
            </Text>
            <Text size="xs" c="dimmed">
              Кто:{' '}
              <Text component="span" c="dark.6">
                {document.deleted_by_name || 'Неизвестно'}
              </Text>
            </Text>
            <Text size="xs" c="dimmed">
              Когда:{' '}
              <Text component="span" c="dark.6">
                {document.deleted_at
                  ? dayjs(document.deleted_at).format('DD.MM.YYYY HH:mm')
                  : '—'}
              </Text>
            </Text>
            <Text size="xs" c="dimmed">
              Причина:{' '}
              <Text component="span" c="dark.6">
                {document.deletion_reason || '—'}
              </Text>
            </Text>
          </Stack>
        </Box>
      </Stack>
    </Modal>
  );
}

const deletionBoxStyle = {
  borderRadius: 6,
  background: 'var(--mantine-color-red-0)',
  border: '1px solid var(--mantine-color-red-2)',
} as const;

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
