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
  useDeletedIncomingMails,
  useDeletedOutgoingMails,
  useRestoreDeletedIncomingMail,
  useRestoreDeletedOutgoingMail,
} from '@/shared/hooks/useMail';
import { useMailPermissions } from '@/shared/hooks/useMailPermissions';
import { useAccountingObjects } from '@/shared/hooks/useAccountingObjects';
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

const ARCHIVE_PAGE_SIZE = 20;

type DeletedMail = IDeletedIncomingMail | IDeletedOutgoingMail;

interface DeletedMailsSectionProps {
  orgId: string;
}

/**
 * Архив удалённых писем — секция администрирования.
 *
 * Перенесена из модалки на странице почты: архив — административная
 * поверхность, а не часть ежедневного чтения реестра. Просмотр истории одной
 * записи остался модалкой (`DeletedMailHistoryModal`) — детальный вид деталями
 * и является.
 *
 * Коллекции `deleted_*` намеренно имеют пустой `listRule`: правило PocketBase не
 * умеет проверить роль внутри организации, поэтому единственная проверка прав —
 * на клиенте. Вкладку скрывает `canViewArchive` в `AdminPage`, кнопку
 * «Восстановить» — `canRestore` здесь; оба флага приходят из
 * `useMailPermissions`, а не из строки роли.
 *
 * Поиск клиентский и честно ограничен загруженной страницей: серверного
 * полнотекстового отбора по архиву нет (`buildDeleted*MailFilter` умеет период,
 * счётчики и связи, но не `search`), а выкачивать весь архив ради подсказки в
 * поле дорого — поэтому граница поиска написана прямо под ним.
 */
export function DeletedMailsSection({ orgId }: DeletedMailsSectionProps) {
  const permissions = useMailPermissions(orgId);
  const { data: accountingObjects } = useAccountingObjects(orgId);

  const [tab, setTab] = useState<MailType>('incoming');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<{ id: string; label: string } | null>(null);

  const listParams = useMemo(() => ({ page, perPage: ARCHIVE_PAGE_SIZE }), [page]);
  const incoming = useDeletedIncomingMails(orgId, listParams);
  const outgoing = useDeletedOutgoingMails(orgId, listParams);
  const active = tab === 'incoming' ? incoming : outgoing;

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
  const folded = foldSearchText(search);
  const isSearchMode = folded !== '';

  const rows = useMemo(
    () =>
      isSearchMode
        ? pageRows.filter((mail) => matchesFolded(searchFieldsOf(mail, tab), folded))
        : pageRows,
    [pageRows, isSearchMode, folded, tab],
  );

  const pageCount = active.data?.totalPages ?? 0;
  const isLoading = active.isLoading;
  const meta = isLoading
    ? ''
    : isSearchMode
      ? 'Поиск идёт по загруженной странице архива.'
      : pageRows.length > 0
        ? `Страница ${page} из ${pageCount || 1}.`
        : '';

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
      <Group justify="space-between" mb="xs" wrap="wrap" gap="xs" align="flex-start">
        <Group gap={8} align="center" wrap="wrap">
          <Title order={4}>Архив удалённых писем</Title>
          <Text size="xs" c="dimmed">
            Удалённые входящие и исходящие письма с возможностью восстановления
          </Text>
        </Group>
        <TextInput
          size="sm"
          leftSection={<IconSearch size={14} />}
          placeholder="Поиск по теме, контрагенту, номеру, комментарию"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSearch('');
          }}
          aria-label="Поиск в архиве сообщений"
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
          w={{ base: '100%', sm: 420 }}
        />
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
            {meta && (
              <Text size="xs" c="dimmed">
                {meta}
              </Text>
            )}

            {isLoading && (
              <Group justify="center" py="xl">
                <Loader size="lg" />
              </Group>
            )}

            {!isLoading && pageRows.length === 0 && (
              <Text c="dimmed" size="sm">
                Удалённых писем нет
              </Text>
            )}

            {!isLoading && pageRows.length > 0 && rows.length === 0 && (
              <Text c="dimmed" size="sm">
                Ничего не найдено
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
                      <Table.Th w={148}>Удалён</Table.Th>
                      <Table.Th w={190} />
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
                            <Text lineClamp={2} title={number}>
                              {number || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text lineClamp={2} title={counterparty}>
                              {counterparty || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text lineClamp={2} title={mail.subject}>
                              {mail.subject || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text lineClamp={2} size="xs" c="dimmed" title={objectName}>
                              {objectName || MAIL_EMPTY_CELL}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" lineClamp={1} title={mail.deleted_by_name}>
                              {mail.deleted_by_name || MAIL_EMPTY_CELL}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatMailTimestamp(mail.deleted_at)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6} justify="flex-end" wrap="nowrap">
                              <Button
                                variant="subtle"
                                size="compact-xs"
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
                                  size="compact-xs"
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
                <Pagination value={page} onChange={setPage} total={pageCount} size="sm" withEdges />
              </Group>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

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
