import { useEffect, useMemo, useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Tabs,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconMailPlus, IconPlus, IconSettings } from '@tabler/icons-react';
import { useAccessibleObjects } from '@/shared/hooks/useAccessibleObjects';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { useUserMap } from '@/shared/hooks/useUserMap';
import { useUpsertUserSetting, useUserSetting } from '@/shared/hooks/useUserSettings';
import {
  useAllIncomingMails,
  useAllOutgoingMails,
  useCreateIncomingMail,
  useCreateOutgoingMail,
  useDeleteIncomingMail,
  useDeleteOutgoingMail,
  useIncomingMail,
  useIncomingMails,
  useOutgoingMail,
  useOutgoingMails,
  useUpdateIncomingMail,
  useUpdateOutgoingMail,
} from '@/shared/hooks/useMail';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';
import { mailSearchFieldsOf } from './mail-field-access';
import { useMailPermissions } from '@/shared/hooks/useMailPermissions';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import {
  MAIL_DELIVERY_METHOD_NAMES,
  type IAccountingObject,
  type IIncomingMail,
  type IOutgoingMail,
  type MailType,
} from '@/shared/types';
import { MAIL_PAGE_SIZE } from '@/api/mail';
import { buildFilterChips, useMailFilters } from './useMailFilters';
import {
  filterByAttachments,
  filterByRelations,
  useOrgMailFiles,
  useOrgMailRelationIds,
} from './useOrgMailFiles';
import { MailFilters } from './MailFilters';
import { MailSearchInput } from './MailSearchInput';
import { MailTable } from './MailTable';
import { toMailRow } from './mail-row';
import type { MailRow } from './mail-row';
import { MailColumnSettingsModal } from './MailColumnSettingsModal';
import { resolveVisibleColumns } from './mail-column-visibility';
import type { MailColumnId } from './mail-columns';
import { MailFormModal } from './MailFormModal';
import { snapshotForHistory } from './mail-form';
import type { MailFormState } from './mail-form';
import { MailFilesModal } from './MailFilesModal';
import { MailHistoryModal } from './MailHistoryModal';
import { MailThreadBuilder } from './MailThreadBuilder';
import { candidateByKey, parentEdgesOf, planLinkChange } from './mail-parent';
import { useMailLinkChange } from './useMailLinkChange';
import { useOrgMailThread } from './useOrgMailThread';
import { useOrgCounterparties } from './useOrgCounterparties';
import { mailNodeKey } from './mail-thread';
import type { MailNodeKey } from './mail-thread';
import { MAIL_REGISTER_TAB_LABELS, MAIL_TYPE_LABELS } from './mail-labels';
import { computeRegisterTarget } from './mail-register-target';
import { MAIL_LETTER_NOT_FOUND_NOTE } from './mail-thread-labels';

interface MailSectionProps {
  orgId: string;
}

type FormTarget =
  | { mode: 'create' }
  | { mode: 'edit'; mailId: string }
  | { mode: 'copy'; mailId: string };

/** Корень дерева переписки с указанием регистра: родитель может быть из другого. */
type ThreadTarget = { mailId: string; mailType: MailType };

const NO_ATTACHMENT_NAMES: string[] = [];

/**
 * Тело страницы почты: заголовок, поиск, две вкладки-регистра и все модалки.
 *
 * Фильтры и поиск общие для обеих вкладок, и это не компромисс, а следствие
 * контракта API: параметр называется `counterparty`, а `buildIncomingMailFilter`
 * и `buildOutgoingMailFilter` сами подставляют нужное поле (`sender` либо
 * `recipient`). Второй набор фильтров пришлось бы синхронизировать вручную, и
 * он бы расходился при переключении вкладок.
 *
 * Различаются вкладки только пагинацией и ключом запроса (`incomingMails` /
 * `outgoingMails`), поэтому переключение вкладки не перезапрашивает уже
 * свежие данные — их держит кэш TanStack Query.
 *
 * Каждое действие gated флагом из `useMailPermissions`: запрещённого действия
 * в интерфейсе нет вовсе, а не «задизейблено». Набор и порядок колонок — тоже
 * (`resolveVisibleColumns` пересекает сохранённое с правами).
 *
 * Ни периода, ни архива здесь нет намеренно: все четыре предустановки периода
 * и произвольный диапазон живут в меню «Фильтр» (`MailFilters`) — единственном
 * месте, где и счётчик активных групп, и сброс живут одним списком. Архив
 * удалённых писем — единственная точка входа из админки («Архив сообщений»,
 * `AdminPage`), а не из реестра: на `/mail` его больше нет.
 */
export function MailSection({ orgId }: MailSectionProps) {
  const permissions = useMailPermissions(orgId);
  const objects = useAccessibleObjects(orgId);
  const { data: orgUsers } = useOrganizationUsers();
  const userMap = useUserMap();
  const { countsByMailId, namesByMailId, isSuccess: filesLoaded } = useOrgMailFiles(orgId);
  const { linkedByType } = useOrgMailRelationIds(orgId);
  const thread = useOrgMailThread(orgId);
  const linkChange = useMailLinkChange(orgId);

  const [tab, setTab] = useState<MailType>('incoming');
  const [page, setPage] = useState(1);
  const filters = useMailFilters();
  const isSearchMode = filters.filters.search.trim() !== '';

  const [highlightedMailId, setHighlightedMailId] = useState<string | null>(null);
  const [highlightRequestId, setHighlightRequestId] = useState(0);

  const requestHighlight = (mailId: string): void => {
    setHighlightedMailId(mailId);
    setHighlightRequestId((prev) => prev + 1);
  };

  const clearHighlight = useCallback(() => {
    setHighlightedMailId(null);
  }, []);

  const handleGoToRegister = (mailId: string, mailType: MailType, dateKey: string): void => {
    setThreadTarget(null);
    filters.resetAll();
    setPage(1);
    if (!dateKey) return;
    const target = computeRegisterTarget(mailType, dateKey, tab);
    if (target.tab !== tab) setTab(target.tab);
    if (target.customFrom && target.customTo) {
      filters.setCustomRange(target.customFrom, target.customTo);
    }
    requestHighlight(mailId);
  };

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [formType, setFormType] = useState<MailType>('incoming');
  const [filesFor, setFilesFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [threadTarget, setThreadTarget] = useState<ThreadTarget | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);

  const query = useMemo(() => {
    const result = { ...filters.query, page, perPage: MAIL_PAGE_SIZE };
    delete result.search;
    return result;
  }, [filters.query, page]);

  const incoming = useIncomingMails(orgId, query);
  const outgoing = useOutgoingMails(orgId, query);

  const foldedQuery = foldSearchText(filters.filters.search);

  const allQuery = useMemo(() => {
    const result = { ...filters.query };
    delete result.search;
    return result;
  }, [filters.query]);

  const incomingAll = useAllIncomingMails(orgId, allQuery, isSearchMode);
  const outgoingAll = useAllOutgoingMails(orgId, allQuery, isSearchMode);

  const pageCount = isSearchMode
    ? Math.ceil(
        (tab === 'incoming' ? (incomingAll.data?.length ?? 0) : (outgoingAll.data?.length ?? 0)) /
          MAIL_PAGE_SIZE,
      )
    : ((tab === 'incoming' ? incoming : outgoing).data?.totalPages ?? 0);

  // Смена вкладки или ЛЮБОГО фильтра возвращает на первую страницу. Иначе
  // пользователь, сидящий на третьей странице входящих, ставит узкий фильтр
  // (или переключает вкладку на исходящие, которых меньше) и получает пустую
  // таблицу без единого объяснения: строк на этой странице просто нет. Все
  // мутации фильтров идут через `useMailFilters`, поэтому одного этого
  // состояния достаточно — `handleSearchChange` ниже лишь сбрасывает страницу
  // раньше, чем дойдёт до эффекта.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [tab, filters.filters]);

  // Страховка от «страницы за последней»: строки удаляются и с этой таблицы
  // (кнопка «Удалить»), и с другого устройства, поэтому общее число страниц
  // может уехать вниз, пока пользователь на последней. `DeletedInvoicesSection`
  // поступает так же.
  useEffect(() => {
    if (pageCount > 0 && page > pageCount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(pageCount);
    }
  }, [page, pageCount]);

  // Подсказки контрагентов нужны, пока открыта форма: словарь качается по
  // требованию, а не при каждом открытии `/mail`.
  const { counterpartyOptions } = useOrgCounterparties(orgId, formTarget !== null);

  const editId = formTarget && formTarget.mode !== 'create' ? formTarget.mailId : '';
  const incomingDetail = useIncomingMail(formType === 'incoming' ? editId : '');
  const outgoingDetail = useOutgoingMail(formType === 'outgoing' ? editId : '');
  const editingMail = (formType === 'incoming' ? incomingDetail.data : outgoingDetail.data) as
    | IIncomingMail
    | IOutgoingMail
    | undefined;

  const createIncoming = useCreateIncomingMail(orgId);
  const createOutgoing = useCreateOutgoingMail(orgId);
  const updateIncoming = useUpdateIncomingMail(orgId);
  const updateOutgoing = useUpdateOutgoingMail(orgId);
  const deleteIncoming = useDeleteIncomingMail(orgId);
  const deleteOutgoing = useDeleteOutgoingMail(orgId);

  const saving =
    createIncoming.isPending ||
    createOutgoing.isPending ||
    updateIncoming.isPending ||
    updateOutgoing.isPending ||
    linkChange.isPending;

  const active = tab === 'incoming' ? incoming : outgoing;
  const activeAll = tab === 'incoming' ? incomingAll : outgoingAll;

  const rows = useMemo<MailRow[]>(() => {
    if (isSearchMode) {
      const allItems = (activeAll.data ?? []) as (IIncomingMail | IOutgoingMail)[];
      const matched = allItems.filter((mail) =>
        matchesFolded(mailSearchFieldsOf(mail, tab), foldedQuery),
      );
      const withFiles = filterByAttachments(
        matched,
        countsByMailId,
        filters.filters.attachments,
        filesLoaded,
      );
      const source = filterByRelations(withFiles, linkedByType[tab], filters.filters.hasRelations);
      const start = (page - 1) * MAIL_PAGE_SIZE;
      const paged = source.slice(start, start + MAIL_PAGE_SIZE);
      return paged.map((mail) =>
        toMailRow(
          mail,
          countsByMailId.get(mail.id) ?? 0,
          namesByMailId.get(mail.id) ?? NO_ATTACHMENT_NAMES,
        ),
      );
    }

    const rawItems = (active.data?.items ?? []) as (IIncomingMail | IOutgoingMail)[];
    const withFiles = filterByAttachments(
      rawItems,
      countsByMailId,
      filters.filters.attachments,
      filesLoaded,
    );
    const source = filterByRelations(withFiles, linkedByType[tab], filters.filters.hasRelations);
    return source.map((mail) =>
      toMailRow(
        mail,
        countsByMailId.get(mail.id) ?? 0,
        namesByMailId.get(mail.id) ?? NO_ATTACHMENT_NAMES,
      ),
    );
  }, [
    active.data,
    activeAll.data,
    isSearchMode,
    foldedQuery,
    tab,
    filters.filters.attachments,
    filters.filters.hasRelations,
    countsByMailId,
    namesByMailId,
    filesLoaded,
    linkedByType,
    page,
  ]);

  const objectNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const object of (objects ?? []) as IAccountingObject[]) {
      map.set(object.id, object.name);
    }
    return map;
  }, [objects]);

  /**
   * Ответственные по id, а не по имени. Словарь склеивал одноимённых в одну
   * подпись, и второго сотрудника «Иванова» нельзя было ни выбрать, ни
   * отобразить: подпись уже занята первым. Ответственных у письма несколько,
   * значит и список людей должен быть кратным, а не уникальным по подписи.
   */
  const responsibleOptions = useMemo(() => {
    if (!orgUsers) return [];
    const byId = new Map<string, string>();
    for (const membership of orgUsers) {
      if (membership.organization_id !== orgId) continue;
      const user = userMap.get(membership.user_id);
      const name = user?.name || user?.login || membership.user_id;
      if (!byId.has(membership.user_id)) byId.set(membership.user_id, name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [orgUsers, orgId, userMap]);

  const responsibleNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of responsibleOptions) map.set(option.id, option.name);
    return map;
  }, [responsibleOptions]);

  const chips = useMemo(
    () =>
      buildFilterChips(filters.filters, {
        mailType: tab,
        objectNames,
        responsibleNames,
        deliveryLabels: MAIL_DELIVERY_METHOD_NAMES,
      }),
    [filters.filters, tab, objectNames, responsibleNames],
  );

  const allowedCreateTypes = useMemo(
    () =>
      (['incoming', 'outgoing'] as MailType[]).filter((type) =>
        type === 'incoming' ? permissions.canCreateIncoming : permissions.canCreateOutgoing,
      ),
    [permissions.canCreateIncoming, permissions.canCreateOutgoing],
  );

  /**
   * Право назвать или снять родителя — то самое, что уже спрашивает кнопка
   * редактирования: создать письмо даёт `canCreate*`, изменить — `canEdit*`.
   * Ровно тот же список флагов, а не роль: роль в почте не решает ничего.
   */
  const canLinkCurrent =
    formTarget?.mode !== 'edit'
      ? allowedCreateTypes.includes(formType)
      : formType === 'incoming'
        ? permissions.canEditIncoming
        : permissions.canEditOutgoing;

  const handleSearchChange = (value: string) => {
    filters.setSearch(value);
    setPage(1);
  };

  // Флеш-подсветка — по образцу `AutoExpandOnHighlight` в реестре счетов.
  // Первого прохода может не хватить: прыжок меняет фильтры, и строка появляется
  // после перезапроса, поэтому через 120 мс селектор ищется ещё раз — как там.
  useEffect(() => {
    if (!highlightedMailId) return;
    const selector = `[data-highlight-id="${CSS.escape(highlightedMailId)}"]`;

    const flash = (el: Element) => {
      if (!el.classList.contains('row-flash')) el.classList.add('row-flash');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const find = (): Element | null => {
      for (const el of document.querySelectorAll(selector)) {
        // Таблица и карточки обе всегда в DOM и разведены `visibleFrom`
        // только стилями, поэтому невидимую ветку подсветка не трогает.
        if (getComputedStyle(el).display !== 'none') return el;
      }
      return null;
    };

    const el = find();
    if (el) {
      flash(el);
      const release = window.setTimeout(() => {
        el.classList.remove('row-flash');
        clearHighlight();
      }, 2600);
      return () => window.clearTimeout(release);
    }

    const retry = window.setTimeout(() => {
      const found = find();
      if (found) flash(found);
      else
        notifications.show({
          color: 'yellow',
          message: MAIL_LETTER_NOT_FOUND_NOTE,
        });
    }, 120);
    return () => window.clearTimeout(retry);
  }, [highlightedMailId, highlightRequestId, clearHighlight]);

  const { data: savedColumns } = useUserSetting('mail_columns');
  const saveColumns = useUpsertUserSetting('mail_columns');

  // Право в зависимостях, а не только в аргументе: `useMailPermissions` отдаёт
  // новый объект при смене любого флага, поэтому отзыв права убирает колонку
  // с открытой страницы, а не после перезагрузки.
  const visibleColumns = useMemo(
    () => resolveVisibleColumns(savedColumns, permissions),
    [savedColumns, permissions],
  );

  const handleColumnChange = (columns: MailColumnId[]) => {
    saveColumns.mutate(columns);
  };

  /**
   * Запись связи в `mail_relations` — строго после успешного сохранения письма.
   * Наоборот нельзя: связь, созданная до неудачного сохранения, пережила бы его
   * откат и осталась бы у письма с прежними полями.
   *
   * Что именно писать, решает `planLinkChange`, и он смотрит только на
   * сохранённые рёбра: `null` — значит человек назвал того же родителя, и запись
   * не нужна. **Номер контрагента в этом решении не участвует вовсе** — правка
   * номера не пишет связь, потому что сюда приходит лишь тот родитель, кого
   * человек назвал сам. Обратно тоже: связь пишется только через
   * `createCrossMailRelation`/`deleteMailRelation`, а они трогают исключительно
   * `mail_relations` и `mail_history`.
   */
  const applyParent = async (
    mailType: MailType,
    savedMail: { id: string },
    parentKey: MailNodeKey | null,
  ) => {
    const isCreate = formTarget?.mode !== 'edit';
    const canLink = isCreate
      ? mailType === 'incoming'
        ? permissions.canCreateIncoming
        : permissions.canCreateOutgoing
      : mailType === 'incoming'
        ? permissions.canEditIncoming
        : permissions.canEditOutgoing;
    if (!canLink) return;

    const plan = planLinkChange(
      parentEdgesOf(thread.parentEdges, mailNodeKey(mailType, savedMail.id)),
      candidateByKey(thread.candidates, parentKey),
    );
    if (!plan) return;
    await linkChange.changeLink({ child: { id: savedMail.id, type: mailType }, plan });
  };

  const handleSave = (mailType: MailType, form: MailFormState, parentKey: MailNodeKey | null) => {
    const shared = {
      date: form.date,
      subject: form.subject.trim(),
      responsible: form.responsible,
      responsible_name: form.responsible
        .split(',')
        .filter(Boolean)
        .map((id) => responsibleNames.get(id) ?? '')
        .filter(Boolean)
        .join(', '),
      accounting_object_id: form.accountingObjectId,
      delivery_method: form.deliveryMethod ?? undefined,
      comment: form.comment.trim(),
    };
    const counterparty = {
      number: form.number.trim(),
      name: form.counterparty.trim(),
      numberOfCounterparty: form.counterpartyNumber.trim(),
    };

    const saved = () => {
      notifications.show({
        color: 'green',
        message:
          formTarget?.mode === 'edit'
            ? `${MAIL_TYPE_LABELS[mailType]} сохранено`
            : `${MAIL_TYPE_LABELS[mailType]} добавлено`,
      });
      setFormTarget(null);
    };

    const afterSave = (savedMail: { id: string }) =>
      applyParent(mailType, savedMail, parentKey)
        .catch(() => undefined)
        .then(saved);

    if (mailType === 'incoming') {
      const fields = {
        ...shared,
        number: counterparty.number,
        sender: counterparty.name,
        sender_outgoing_number: counterparty.numberOfCounterparty,
      };
      const request =
        formTarget?.mode === 'edit'
          ? updateIncoming.mutateAsync({
              id: formTarget.mailId,
              data: fields,
              previousData: editingMail ? snapshotForHistory(mailType, editingMail) : {},
            })
          : createIncoming.mutateAsync({ organization_id: orgId, ...fields });
      request.then(afterSave).catch(() => undefined);
      return;
    }

    const fields = {
      ...shared,
      outgoing_number: counterparty.number,
      recipient: counterparty.name,
      counterparty_incoming_number: counterparty.numberOfCounterparty,
    };
    const request =
      formTarget?.mode === 'edit'
        ? updateOutgoing.mutateAsync({
            id: formTarget.mailId,
            data: fields,
            previousData: editingMail ? snapshotForHistory(mailType, editingMail) : {},
          })
        : createOutgoing.mutateAsync({ organization_id: orgId, ...fields });
    request.then(afterSave).catch(() => undefined);
  };

  const confirmDelete = () => {
    if (!deleteFor) return;
    const mutation = tab === 'incoming' ? deleteIncoming : deleteOutgoing;
    setDeleteFor(null);
    mutation.mutate(deleteFor);
  };

  const labelFor = (mailId: string | null): string => {
    if (!mailId) return '';
    const row = rows.find((candidate) => candidate.id === mailId);
    return row?.number || row?.subject || mailId;
  };

  if (!orgId) return null;

  if (!objects) {
    return (
      <Stack gap="sm" py="xs">
        <Skeleton height={32} radius="sm" />
        <Skeleton height={140} radius="md" />
        <Skeleton height={140} radius="md" />
      </Stack>
    );
  }

  return (
    <>
      <Paper withBorder p="md" style={{ boxShadow: 'var(--mantine-shadow-sm)' }}>
        <Group justify="space-between" mb="sm" wrap="wrap" gap="xs">
          <Group gap={8} align="center" wrap="wrap">
            <Title order={5}>Почта</Title>
            <Tooltip label="Настройка колонок">
              <ActionIcon
                size="md"
                variant="subtle"
                color="gray"
                aria-label="Настройка колонок"
                onClick={() => setColumnSettingsOpen(true)}
              >
                <IconSettings size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>
          {allowedCreateTypes.length > 0 && (
            <Button
              size="md"
              variant="light"
              leftSection={
                allowedCreateTypes.length === 1 ? (
                  <IconPlus size={18} />
                ) : (
                  <IconMailPlus size={18} />
                )
              }
              onClick={() => {
                setFormType(allowedCreateTypes[0]!);
                setFormTarget({ mode: 'create' });
              }}
            >
              Создать письмо
            </Button>
          )}
        </Group>

        <Box mb="sm">
          <MailSearchInput
            value={filters.filters.search}
            onChange={handleSearchChange}
            scopeLabel="переписке"
            resultCount={rows.length}
            resultTotal={
              isSearchMode ? (activeAll.data?.length ?? 0) : (active.data?.totalItems ?? 0)
            }
          />
        </Box>

        <Tabs
          value={tab}
          onChange={(value) => value && setTab(value as MailType)}
          keepMounted={false}
        >
          <Tabs.List>
            <Tabs.Tab value="incoming">{MAIL_REGISTER_TAB_LABELS.incoming}</Tabs.Tab>
            <Tabs.Tab value="outgoing">{MAIL_REGISTER_TAB_LABELS.outgoing}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value={tab} pt="md">
            <Stack gap="sm">
              <MailFilters
                filters={filters}
                mailType={tab}
                accountingObjects={(objects ?? []).map((object) => ({
                  id: object.id,
                  name: object.name,
                }))}
                responsibleOptions={responsibleOptions}
                chips={chips}
              />
              <Box>
                <MailTable
                  orgId={orgId}
                  mailType={tab}
                  rows={rows}
                  visibleColumns={visibleColumns}
                  loading={isSearchMode ? activeAll.isLoading : active.isLoading}
                  objectNames={objectNames}
                  permissions={permissions}
                  page={page}
                  pageCount={pageCount}
                  totalItems={
                    isSearchMode ? (activeAll.data?.length ?? 0) : (active.data?.totalItems ?? 0)
                  }
                  onPageChange={setPage}
                  onOpenFiles={setFilesFor}
                  onEdit={(mailId) => {
                    setFormType(tab);
                    setFormTarget({ mode: 'edit', mailId });
                  }}
                  onCopy={(mailId) => {
                    setFormType(tab);
                    setFormTarget({ mode: 'copy', mailId });
                  }}
                  onDelete={setDeleteFor}
                  onHistory={setHistoryFor}
                  onRelations={(mailId) => setThreadTarget({ mailId, mailType: tab })}
                  onResetFilters={filters.resetAll}
                  hasFilters={filters.activeCount > 0}
                  highlightedMailId={highlightedMailId}
                  emptyHint={
                    filters.activeCount > 0 ? 'Писем по заданным условиям нет' : 'Писей пока нет'
                  }
                />
              </Box>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <MailFormModal
        opened={formTarget !== null}
        onClose={() => setFormTarget(null)}
        mailType={formType}
        mail={formTarget && formTarget.mode !== 'create' ? (editingMail ?? null) : null}
        copying={formTarget?.mode === 'copy'}
        allowedTypes={allowedCreateTypes}
        accountingObjects={[...objectNames].map(([value, label]) => ({ value, label }))}
        responsibleOptions={responsibleOptions.map((option) => ({
          value: option.id,
          label: option.name,
        }))}
        counterpartyOptions={counterpartyOptions}
        candidates={thread.candidates}
        parentEdges={thread.parentEdges}
        canLink={canLinkCurrent}
        saving={saving}
        onTypeChange={setFormType}
        onSave={handleSave}
        onOpenThread={(mailType, mailId) => setThreadTarget({ mailId, mailType })}
      />

      <MailFilesModal
        mailId={filesFor}
        mailType={tab}
        mailLabel={labelFor(filesFor)}
        orgId={orgId}
        opened={filesFor !== null}
        canManageFiles={permissions.canManageFiles}
        onClose={() => setFilesFor(null)}
      />

      <MailHistoryModal
        mailId={historyFor}
        mailType={tab}
        mailLabel={labelFor(historyFor)}
        createdByName={rows.find((row) => row.id === historyFor)?.createdByName}
        createdAt={rows.find((row) => row.id === historyFor)?.created}
        opened={historyFor !== null}
        onClose={() => setHistoryFor(null)}
      />

      <MailThreadBuilder
        opened={threadTarget !== null}
        onClose={() => setThreadTarget(null)}
        orgId={orgId}
        permissions={permissions}
        rootMailId={threadTarget?.mailId ?? ''}
        rootMailType={threadTarget?.mailType ?? tab}
        onGoToRegister={handleGoToRegister}
      />

      <MailColumnSettingsModal
        key={columnSettingsOpen ? 'open' : 'closed'}
        opened={columnSettingsOpen}
        value={visibleColumns}
        permissions={permissions}
        mailType={tab}
        onChange={handleColumnChange}
        onClose={() => setColumnSettingsOpen(false)}
      />

      <ConfirmModal
        opened={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={confirmDelete}
        title="Удаление письма"
        message="Письмо переместится в архив. Вложения останутся доступны и после восстановления."
      />
    </>
  );
}
