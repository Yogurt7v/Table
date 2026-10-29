import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Loader,
  Pagination,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconHistory, IconRestore, IconSearch, IconX } from '@tabler/icons-react';
import {
  useAllDeletedIncomingMails,
  useAllDeletedOutgoingMails,
  useDeletedIncomingMails,
  useDeletedOutgoingMails,
  useRestoreDeletedIncomingMail,
  useRestoreDeletedOutgoingMail,
} from '@/shared/hooks/useMail';
import { useMailPermissions } from '@/shared/hooks/useMailPermissions';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
import { ARCHIVE_PAGE_SIZE } from '@/api/collections';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';
import type {
  IAccountingObject,
  IDeletedIncomingMail,
  IDeletedOutgoingMail,
  MailType,
} from '@/shared/types';
import { DeletedMailHistoryModal } from '@/features/mail/MailArchiveHistoryModal';
import { formatMailDate, formatMailTimestamp } from '@/features/mail/mail-date';
import {
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_EMPTY_CELL,
  MAIL_NUMBER_FIELD_LABELS,
  MAIL_REGISTER_TAB_LABELS,
  MAIL_TYPE_LABELS,
} from '@/features/mail/mail-labels';
import { DeletedMailDetailModal } from './DeletedMailDetailModal';

type DeletedMail = IDeletedIncomingMail | IDeletedOutgoingMail;

interface DeletedMailsSectionProps {
  orgId: string;
}

/**
 * Архив удалённых писем — секция администрирования.
 *
 * Просмотр истории одной записи остался модалкой (`DeletedMailHistoryModal`),
 * детали записи — `DeletedMailDetailModal`.
 *
 * Коллекции `deleted_*` намеренно имеют пустой `listRule`: правило PocketBase не
 * умеет проверить роль внутри организации, поэтому единственная проверка прав —
 * на клиенте. Вкладку скрывает `canViewArchive` в `AdminPage`, кнопку
 * «Восстановить» — `permissions.canRestore` здесь; оба флага приходят из
 * `useMailPermissions`, а не из строки роли.
 *
 * Поиск идёт по всему архиву: в режиме поиска секция выкачивает полный список
 * (`useAllDeleted*Mails`) и фильтрует его на клиенте, вне поиска работает
 * серверная пагинация.
 */
export function DeletedMailsSection({ orgId }: DeletedMailsSectionProps) {
  const permissions = useMailPermissions(orgId);
  const { data: accountingObjects } = useAccountingObjects(orgId);

  const [tab, setTab] = useState<MailType>('incoming');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activatedQuery, setActivatedQuery] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<{ id: string; label: string } | null>(null);
  const [detailMail, setDetailMail] = useState<DeletedMail | null>(null);

  const listParams = useMemo(() => ({ page, perPage: ARCHIVE_PAGE_SIZE }), [page]);
  const incoming = useDeletedIncomingMails(orgId, listParams);
  const outgoing = useDeletedOutgoingMails(orgId, listParams);
  const active = tab === 'incoming' ? incoming : outgoing;

  const searchQuery = foldSearchText(activatedQuery);
  const isSearchMode = searchQuery !== '';
  const allIncoming = useAllDeletedIncomingMails(orgId, isSearchMode && tab === 'incoming');
  const allOutgoing = useAllDeletedOutgoingMails(orgId, isSearchMode && tab === 'outgoing');
  const allActive = tab === 'incoming' ? allIncoming : allOutgoing;

  const restoreIncoming = useRestoreDeletedIncomingMail(orgId);
  const restoreOutgoing = useRestoreDeletedOutgoingMail(orgId);
  const restoring = restoreIncoming.isPending || restoreOutgoing.isPending;

  const objectNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const object of (accountingObjects ?? []) as IAccountingObject[]) {
      map.set(object.id, object.name);
    }
    return map;
  }, [accountingObjects]);

  const pageRows = useMemo(() => (active.data?.items ?? []) as DeletedMail[], [active.data]);
  const allRows = useMemo(
    () => ((allActive.data ?? []) as DeletedMail[]),
    [allActive.data],
  );

  const rows = useMemo(() => {
    if (!isSearchMode) return pageRows;
    return allRows.filter((mail) => matchesFolded(searchFieldsOf(mail, tab), searchQuery));
  }, [pageRows, allRows, isSearchMode, searchQuery, tab]);

  const pageCount = active.data?.totalPages ?? 0;
  const isLoading = isSearchMode ? allActive.isLoading : active.isLoading;

  const objectNameOf = (mail: DeletedMail) =>
    mail.accounting_object_id ? (objectNames.get(mail.accounting_object_id) ?? '') : '';

  const handleRestore = (id: string) => {
    setRestoringId(id);
    const mutation = tab === 'incoming' ? restoreIncoming : restoreOutgoing;
    mutation
      .mutateAsync(id)
      .then(() => setPage(1))
      .finally(() => setRestoringId(null));
  };

  if (!orgId) return null;

  return (
    <div>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs">
          <Title order={4}>Архив писем</Title>
        </Group>
        <TextInput
          w={480}
          size="sm"
          leftSection={<IconSearch size={14} />}
          placeholder="Поиск по теме, контрагенту, номеру, комментарию"
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
          aria-label="Поиск в архиве сообщений"
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

      <Tabs
        value={tab}
        onChange={(value) => {
          if (!value) return;
          setTab(value as MailType);
          setPage(1);
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="incoming">{MAIL_REGISTER_TAB_LABELS.incoming}</Tabs.Tab>
          <Tabs.Tab value="outgoing">{MAIL_REGISTER_TAB_LABELS.outgoing}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value={tab} pt="md">
          <Stack gap="xs">
            {isLoading && (
              <Group justify="center" py="xl">
                <Loader size="lg" />
              </Group>
            )}

            {!isLoading && rows.length === 0 && (
              <Text c="dimmed" size="sm">
                {isSearchMode ? 'Ничего не найдено' : 'Архив пуст'}
              </Text>
            )}

            {!isLoading && rows.length > 0 && (
              <Box style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={56}>№</Table.Th>
                      <Table.Th w={96}>Дата</Table.Th>
                      <Table.Th w={165}>{MAIL_NUMBER_FIELD_LABELS[tab]}</Table.Th>
                      <Table.Th w={210}>{MAIL_COUNTERPARTY_FIELD_LABELS[tab]}</Table.Th>
                      <Table.Th>Тема</Table.Th>
                      <Table.Th w={120}>Объект учёта</Table.Th>
                      <Table.Th w={140}>Удалил</Table.Th>
                      <Table.Th w={140}>Удалён</Table.Th>
                      <Table.Th w={260} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((mail) => {
                      const counterparty = counterpartyOf(mail, tab);
                      const number = numberOf(mail, tab);
                      const objectName = objectNameOf(mail);
                      return (
                        <Table.Tr key={mail.id}>
                          <Table.Td>{mail.seq ?? MAIL_EMPTY_CELL}</Table.Td>
                          <Table.Td>{formatMailDate(mail.date) || MAIL_EMPTY_CELL}</Table.Td>
                          <Table.Td>
                            <Text lineClamp={1} title={number} aria-label={number}>
                              {number || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              lineClamp={1}
                              title={counterparty}
                              aria-label={counterparty}
                            >
                              {counterparty || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              lineClamp={1}
                              title={mail.subject}
                              aria-label={mail.subject}
                            >
                              {mail.subject || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              lineClamp={1}
                              size="xs"
                              c="dimmed"
                              title={objectName}
                              aria-label={objectName}
                            >
                              {objectName || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="xs"
                              c="dimmed"
                              lineClamp={1}
                              title={mail.deleted_by_name}
                              aria-label={mail.deleted_by_name}
                            >
                              {mail.deleted_by_name || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="xs"
                              c="dimmed"
                              title={formatMailTimestamp(mail.deleted_at)}
                              aria-label={formatMailTimestamp(mail.deleted_at)}
                            >
                              {formatMailTimestamp(mail.deleted_at) || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6} justify="flex-end" wrap="nowrap">
                              <Button
                                variant="subtle"
                                size="compact-sm"
                                onClick={() => setDetailMail(mail)}
                              >
                                Просмотреть
                              </Button>
                              <Button
                                variant="subtle"
                                size="compact-sm"
                                leftSection={<IconHistory size={14} />}
                                onClick={() =>
                                  setHistoryFor({
                                    id: mail.id,
                                    label: `${MAIL_TYPE_LABELS[tab]} № ${number || mail.id}`,
                                  })
                                }
                              >
                                История
                              </Button>
                              {permissions.canRestore && (
                                <Button
                                  variant="light"
                                  color="green"
                                  size="compact-sm"
                                  leftSection={<IconRestore size={14} />}
                                  loading={restoring && restoringId === mail.id}
                                  onClick={() => handleRestore(mail.id)}
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

            {!isSearchMode && pageCount > 1 && (
              <Group justify="center" mt="md">
                <Pagination value={page} onChange={setPage} total={pageCount} size="sm" />
              </Group>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <DeletedMailDetailModal
        mail={detailMail}
        mailType={tab}
        objectName={detailMail ? objectNameOf(detailMail) : ''}
        opened={!!detailMail}
        onClose={() => setDetailMail(null)}
      />

      {historyFor && (
        <DeletedMailHistoryModal
          deletedMailId={historyFor.id}
          mailType={tab}
          mailLabel={historyFor.label}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}

/** Отправитель входящего письма либо получатель исходящего. */
function counterpartyOf(mail: DeletedMail, tab: MailType): string {
  return tab === 'incoming'
    ? (mail as IDeletedIncomingMail).sender
    : (mail as IDeletedOutgoingMail).recipient;
}

/** Номер письма в своём регистре. */
function numberOf(mail: DeletedMail, tab: MailType): string {
  return tab === 'incoming'
    ? ((mail as IDeletedIncomingMail).number ?? '')
    : (mail as IDeletedOutgoingMail).outgoing_number;
}

/** Поля строки, по которым ищет архив: контрагент, номер, тема, комментарий, кто удалил. */
function searchFieldsOf(mail: DeletedMail, tab: MailType): (string | undefined)[] {
  return [
    counterpartyOf(mail, tab),
    numberOf(mail, tab),
    mail.subject,
    mail.comment,
    mail.deleted_by_name,
  ];
}
