import { Text, Group, Paper, TextInput } from '@mantine/core';
import { IconArchive } from '@tabler/icons-react';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { IInvoice } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';

interface InvoiceTableDeleteConfirmProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleteTarget: IInvoice | null;
  deleteReason: string;
  setDeleteReason: (reason: string) => void;
  loading: boolean;
}

export function InvoiceTableDeleteConfirm({
  opened,
  onClose,
  onConfirm,
  deleteTarget,
  deleteReason,
  setDeleteReason,
  loading,
}: InvoiceTableDeleteConfirmProps) {
  const deleteSubjectMeta = deleteTarget
    ? [
        deleteTarget.invoice_no ? `Счёт № ${deleteTarget.invoice_no}` : null,
        deleteTarget.purpose || null,
      ].filter((part): part is string => Boolean(part))
    : [];

  const deleteSubject = deleteTarget ? (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between" align="baseline" gap="sm" wrap="nowrap">
        <Text fw={600} lh={1.35} lineClamp={2} flex={1}>
          {deleteTarget.counterparty || deleteTarget.invoice_no || 'Счёт без контрагента'}
        </Text>
        <Text fw={600} lh={1.35} fz="md" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatAmountRub(deleteTarget.amount)}
        </Text>
      </Group>
      {deleteSubjectMeta.length > 0 && (
        <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
          {deleteSubjectMeta.join(' · ')}
        </Text>
      )}
    </Paper>
  ) : null;

  const deleteNote = (
    <Text size="sm" c="dimmed" lh={1.45}>
      Счёт переместится в архив. Его можно восстановить вместе с историей изменений.
    </Text>
  );

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Удаление счёта"
      size="md"
      subject={deleteSubject}
      note={deleteNote}
      loading={loading}
      confirmDisabled={deleteReason.trim() === '' || loading}
      confirmLeftSection={<IconArchive size={16} />}
      confirmBlocked
    >
      <TextInput
        label="Причина удаления"
        aria-label="Причина удаления"
        placeholder="Например: счёт создан ошибочно"
        description={
          <Group component="span" justify="space-between" gap="sm" wrap="nowrap">
            <Text component="span" size="xs" flex={1}>
              Сохранится в архивной записи и в истории счёта.
            </Text>
            <Text component="span" size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {deleteReason.length > 0 ? `${deleteReason.length} симв.` : ''}
            </Text>
          </Group>
        }
        value={deleteReason}
        onChange={(event) => setDeleteReason(event.currentTarget.value)}
        disabled={loading}
        required
      />
    </ConfirmModal>
  );
}
