import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Loader,
  Pagination,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useArchivedDocuments, useRestoreDocument } from '@/shared/hooks/useDocuments';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { ARCHIVE_PAGE_SIZE } from '@/api/collections';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';
import type { IDocument } from '@/shared/types';
import { DeletedDocumentDetailModal } from './DeletedDocumentDetailModal';

interface DeletedDocumentsSectionProps {
  orgId: string;
}

export function DeletedDocumentsSection({ orgId }: DeletedDocumentsSectionProps) {
  const archivedQuery = useArchivedDocuments(orgId);
  const objectsQuery = useAccountingObjects(orgId);
  const restoreDocument = useRestoreDocument(orgId);
  const [search, setSearch] = useState('');
  const [activatedQuery, setActivatedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [detailDocument, setDetailDocument] = useState<IDocument | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<IDocument | null>(null);

  const objectNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const object of objectsQuery.data ?? []) map.set(object.id, object.name);
    return map;
  }, [objectsQuery.data]);

  const searchQuery = foldSearchText(activatedQuery);
  const isSearchMode = searchQuery !== '';

  const documents = useMemo(() => {
    const all = archivedQuery.data ?? [];
    if (!isSearchMode) return all;
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
        searchQuery,
      ),
    );
  }, [archivedQuery.data, objectNames, isSearchMode, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(documents.length / ARCHIVE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageDocuments = isSearchMode
    ? documents
    : documents.slice((safePage - 1) * ARCHIVE_PAGE_SIZE, safePage * ARCHIVE_PAGE_SIZE);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restoreDocument.mutateAsync(restoreTarget);
      notifications.show({ color: 'green', message: 'Документ восстановлен' });
      setRestoreTarget(null);
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось восстановить документ' });
      setRestoreTarget(null);
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs">
          <Title order={4}>Архив документов</Title>
        </Group>
        <TextInput
          w={480}
          size="sm"
          leftSection={<IconSearch size={14} />}
          placeholder="Поиск по контрагенту, назначению, договору, причине"
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            if (e.currentTarget.value !== activatedQuery) {
              setActivatedQuery('');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setActivatedQuery(search);
            }
          }}
          aria-label="Поиск в архиве документов"
          rightSection={
            search ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Очистить поиск"
                onClick={() => {
                  setSearch('');
                  setActivatedQuery('');
                }}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          rightSectionPointerEvents="all"
        />
        {search.trim() !== '' && (
          <Button
            variant="light"
            size="compact-sm"
            leftSection={<IconSearch size={14} />}
            onClick={() => setActivatedQuery(search)}
          >
            Найти
          </Button>
        )}
      </Group>

      {archivedQuery.isLoading && (
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      )}

      {!archivedQuery.isLoading && documents.length === 0 && (
        <Text c="dimmed" size="sm">
          {isSearchMode ? 'Ничего не найдено' : 'Архив пуст'}
        </Text>
      )}

      {!archivedQuery.isLoading && pageDocuments.length > 0 && (
        <Box >
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={56}>№</Table.Th>
                <Table.Th w={116}>Дата оплаты</Table.Th>
                <Table.Th>Объект</Table.Th>
                <Table.Th >Контрагент</Table.Th>
                <Table.Th w={120} ta="right">
                  Сумма
                </Table.Th>
                <Table.Th>Ответственный</Table.Th>
                <Table.Th w={140}>Удалил</Table.Th>
                <Table.Th w={140}>Удалён</Table.Th>
                <Table.Th>Причина</Table.Th>
                <Table.Th w={200} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pageDocuments.map((document) => {
                const objectName = objectNames.get(document.accounting_object_id) ?? '—';
                return (
                  <Table.Tr key={document.id}>
                    <Table.Td>{document.seq}</Table.Td>
                    <Table.Td>
                      {document.payment_date
                        ? dayjs(document.payment_date).format('DD.MM.YYYY')
                        : '—'}
                    </Table.Td>
                    <Table.Td title={objectName} aria-label={objectName}>
                      {objectName}
                    </Table.Td>
                    <Table.Td>
                      <Text
                        lineClamp={1}
                        title={document.counterparty}
                        aria-label={document.counterparty}
                      >
                        {document.counterparty || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td
                      ta="right"
                      aria-label={String(document.amount)}
                      title={String(document.amount)}
                    >
                      {document.amount ? formatAmountRub(document.amount) : '—'}
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="xs"
                        c="dimmed"
                        lineClamp={1}
                        title={document.responsible_name}
                        aria-label={document.responsible_name}
                      >
                        {document.responsible_name || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="xs"
                        c="dimmed"
                        lineClamp={1}
                        title={document.deleted_by_name}
                        aria-label={document.deleted_by_name}
                      >
                        {document.deleted_by_name || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="xs"
                        c="dimmed"
                        aria-label={
                          document.deleted_at
                            ? dayjs(document.deleted_at).format('DD.MM.YYYY HH:mm')
                            : ''
                        }
                        title={
                          document.deleted_at
                            ? dayjs(document.deleted_at).format('DD.MM.YYYY HH:mm')
                            : ''
                        }
                      >
                        {document.deleted_at
                          ? dayjs(document.deleted_at).format('DD.MM.YYYY HH:mm')
                          : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        lineClamp={1}
                        title={document.deletion_reason}
                        aria-label={document.deletion_reason}
                      >
                        {document.deletion_reason || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} justify="flex-end" wrap="nowrap">
                        <Button
                          variant="subtle"
                          size="compact-sm"
                          onClick={() => setDetailDocument(document)}
                        >
                          Просмотреть
                        </Button>
                        <Button
                          variant="light"
                          color="green"
                          size="compact-sm"
                          onClick={() => setRestoreTarget(document)}
                        >
                          Восстановить
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      {!isSearchMode && totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination value={safePage} onChange={setPage} total={totalPages} size="sm" />
        </Group>
      )}

      <DeletedDocumentDetailModal
        document={detailDocument}
        objectName={
          detailDocument ? (objectNames.get(detailDocument.accounting_object_id) ?? '') : ''
        }
        opened={!!detailDocument}
        onClose={() => setDetailDocument(null)}
      />

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
