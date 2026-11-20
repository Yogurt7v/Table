import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MAIL_DELIVERY_METHOD_NAMES,
  type IAccountingObject,
  type IIncomingMail,
  type IOutgoingMail,
  type MailType,
} from '@/shared/types';
import { MAIL_PAGE_SIZE } from '@/api/mail';
import { useAccessibleObjects } from '@/features/accounts/hooks/useAccessibleObjects';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { useUserMap } from '@/shared/hooks/useUserMap';
import { useMailPermissions } from '@/shared/hooks/useMailPermissions';
import {
  useAllIncomingMails,
  useAllOutgoingMails,
  useIncomingMails,
  useOutgoingMails,
} from '@/shared/hooks/useMail';
import { useUpsertUserSetting, useUserSetting } from '@/shared/hooks/useUserSettings';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';
import { mailSearchFieldsOf } from '@/features/mail/mail-field-access';
import { buildFilterChips, useMailFilters } from '@/features/mail/useMailFilters';
import {
  filterByAttachments,
  filterByRelations,
  useOrgMailFiles,
  useOrgMailRelationIds,
} from '@/features/mail/useOrgMailFiles';
import { useOrgMailThread } from '@/features/mail/useOrgMailThread';
import { resolveVisibleColumns } from '@/features/mail/mail-column-visibility';
import type { MailColumnId } from '@/features/mail/mail-columns';
import { toMailRow, type MailRow } from '@/features/mail/mail-row';

const NO_ATTACHMENT_NAMES: string[] = [];

/**
 * Данные реестра писем одной организации: выборки обоих регистров, фильтрация
 * и построение строк таблицы, словари объектов учёта и ответственных, чипы
 * активных фильтров, права создания писем, видимые колонки и пагинация.
 *
 * Вкладка (`tab`) приходит снаружи: на неё завязаны и сброс страницы ниже, и
 * переход из дерева переписки в `MailSection`.
 */
export function useMailSectionData(orgId: string, tab: MailType) {
  const permissions = useMailPermissions(orgId);
  const objects = useAccessibleObjects(orgId);
  const { data: orgUsers } = useOrganizationUsers();
  const userMap = useUserMap();
  const { countsByMailId, namesByMailId, isSuccess: filesLoaded } = useOrgMailFiles(orgId);
  const { linkedByType } = useOrgMailRelationIds(orgId);
  const thread = useOrgMailThread(orgId);

  const filters = useMailFilters();
  const isSearchMode = filters.filters.search.trim() !== '';

  const [page, setPage] = useState(1);

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
  // может уехать вниз, пока пользователь на последней.
  useEffect(() => {
    if (pageCount > 0 && page > pageCount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(pageCount);
    }
  }, [page, pageCount]);

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

  const handleSearchChange = useCallback(
    (value: string) => {
      filters.setSearch(value);
      setPage(1);
    },
    [filters],
  );

  return {
    permissions,
    objects,
    thread,
    filters,
    isSearchMode,
    rows,
    objectNames,
    responsibleOptions,
    responsibleNames,
    chips,
    allowedCreateTypes,
    visibleColumns,
    active,
    activeAll,
    page,
    pageCount,
    setPage,
    handleColumnChange,
    handleSearchChange,
  };
}

/** Данные раздела почты, которые отдаёт useMailSectionData. */
export type MailSectionData = ReturnType<typeof useMailSectionData>;
