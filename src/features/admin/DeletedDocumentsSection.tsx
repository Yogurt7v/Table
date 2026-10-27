import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useArchivedDocuments, useRestoreDocument } from '@/shared/hooks/useDocuments';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';
import type { IDocument } from '@/shared/types';

interface DeletedDocumentsSectionProps {
  orgId: string;
}

export function DeletedDocumentsSection({ orgId }: DeletedDocumentsSectionProps) {
  const archivedQuery = useArchivedDocuments(orgId);
  const objectsQuery = useAccountingObjects(orgId);
  const restoreDocument = useRestoreDocument(orgId);
  const [search, setSearch] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<IDocument | null>(null);

  const objectNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const object of objectsQuery.data ?? []) map.set(object.id, object.name);
    return map;
  }, [objectsQuery.data]);

  const documents = useMemo(() => {
    const folded = foldSearchText(search);
    const all = archivedQuery.data ?? [];
    if (!folded) return all;
    return all.filter((document) =>
      matchesFolded(
        [
          document.counterparty,
          document.purpose,
          document.contract_no,
          document.invoice_no,
          document.responsible_name,
          document.deleted_by_name,
          document.deletion_reason,
          objectNames.get(document.accounting_object_id),
        ],
        folded,
      ),
    );
  }, [archivedQuery.data, objectNames, search]);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restoreDocument.mutateAsync(restoreTarget);
      notifications.show({ color: 'green', message: 'Документ восстановлен' });
      setRestoreTarget(null);
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось восстановить документ' });
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Title order={4}>Архив документов</Title>
        <TextInput
          w={480}
          size="sm"
          leftSection={<IconSearch size={14} />}
          placeholder="Поиск по контрагенту, назначению, причине"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          rightSection={
            search ? (
              <ActionIcon variant="subtle" aria-label="Очистить поиск" onClick={() => setSearch('')}>
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          aria-label="Поиск в архиве документов"
        />
      </Group>

      {archivedQuery.isLoading ? (
        <Loader />
      ) : documents.length === 0 ? (
        <Text c="dimmed">Архив документов пуст</Text>
      ) : (
        <Paper withBorder>
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>№</Table.Th>
                  <Table.Th>Дата оплаты</Table.Th>
                  <Table.Th>Объект</Table.Th>
                  <Table.Th>Контрагент</Table.Th>
                  <Table.Th>Сумма</Table.Th>
                  <Table.Th>Ответственный</Table.Th>
                  <Table.Th>Удалил</Table.Th>
                  <Table.Th>Причина</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {documents.map((document) => (
                  <Table.Tr key={document.id}>
                    <Table.Td>{document.seq}</Table.Td>
                    <Table.Td>
                      {document.payment_date
                        ? dayjs(document.payment_date).format('DD.MM.YYYY')
                        : '—'}
                    </Table.Td>
                    <Table.Td>{objectNames.get(document.accounting_object_id) ?? '—'}</Table.Td>
                    <Table.Td style={{ maxWidth: 260 }}>
                      <Text size="sm" truncate>
                        {document.counterparty}
                      </Text>
                      {document.purpose && (
                        <Text size="xs" c="dimmed" truncate>
                          {document.purpose}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{document.amount ? formatAmountRub(document.amount) : '—'}</Table.Td>
                    <Table.Td>{document.responsible_name || '—'}</Table.Td>
                    <Table.Td>
                      <Text size="sm">{document.deleted_by_name || '—'}</Text>
                      <Text size="xs" c="dimmed">
                        {document.deleted_at
                          ? dayjs(document.deleted_at).format('DD.MM.YYYY HH:mm')
                          : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ maxWidth: 260 }}>
                      <Text size="sm" truncate>
                        {document.deletion_reason || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Восстановить">
                        <ActionIcon
                          color="green"
                          variant="subtle"
                          aria-label="Восстановить документ"
                          onClick={() => setRestoreTarget(document)}
                        >
                          <IconRefresh size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      <ConfirmModal
        opened={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
        title="Восстановление документа"
        message={`Восстановить документ №${restoreTarget?.seq ?? ''} «${restoreTarget?.counterparty ?? ''}»?`}
        confirmLabel="Восстановить"
        color="green"
        loading={restoreDocument.isPending}
      />
    </div>
  );
}
