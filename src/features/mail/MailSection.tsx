import { useEffect, useMemo, useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { Skeleton, Stack, Paper } from '@mantine/core';
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
import {
  MAIL_DELIVERY_METHOD_NAMES,
  type IAccountingObject,
  type IIncomingMail,
  type IOutgoingMail,
  type MailType,
} from '@/shared/types';
import { buildFilterChips, useMailFilters } from './useMailFilters';
import {
  filterByAttachments,
  filterByRelations,
  useOrgMailFiles,
  useOrgMailRelationIds,
} from './useOrgMailFiles';
import { candidateByKey, parentEdgesOf, planLinkChange } from './mail-parent';
import { useMailLinkChange } from './useMailLinkChange';
import { useOrgMailThread } from './useOrgMailThread';
import { useOrgCounterparties } from './useOrgCounterparties';
import { mailNodeKey } from './mail-thread';
import type { MailNodeKey } from './mail-thread';
import { MAIL_TYPE_LABELS } from './mail-labels';
import { computeRegisterTarget } from './mail-register-target';
import { MAIL_LETTER_NOT_FOUND_NOTE } from './mail-thread-labels';
import { resolveVisibleColumns } from './mail-column-visibility';
import type { MailColumnId } from './mail-columns';
import { MAIL_PAGE_SIZE } from '@/api/mail';
import { snapshotForHistory } from './mail-form';
import type { MailFormState } from './mail-form';
import { toMailRow, type MailRow } from './mail-row';
import { MailSectionModals } from './components/mail-section/MailSectionModals';
import { MailSectionTable } from './components/mail-section/MailSectionTable';
import { MailSectionHeader } from './components/mail-section/MailSectionHeader';
import { buildDeleteMailSubject } from './components/mail-section/delete-mail-subject';

interface MailSectionProps {
  orgId: string;
}

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

  type FormTarget =
    | { mode: 'create' }
    | { mode: 'edit'; mailId: string }
    | { mode: 'copy'; mailId: string; sourceType: MailType };

  type ThreadTarget = { mailId: string; mailType: MailType };

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [formType, setFormType] = useState<MailType>('incoming');
  const [filesFor, setFilesFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [threadTarget, setThreadTarget] = useState<ThreadTarget | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [tab, filters.filters]);

  useEffect(() => {
    if (pageCount > 0 && page > pageCount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const { counterpartyOptions } = useOrgCounterparties(orgId, formTarget !== null);

  const editId =
    formTarget === null || formTarget.mode === 'create'
      ? ''
      : formTarget.mode === 'copy' && formType !== formTarget.sourceType
        ? ''
        : formTarget.mailId;
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
          namesByMailId.get(mail.id) ?? [],
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
        namesByMailId.get(mail.id) ?? [],
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

  useEffect(() => {
    if (!highlightedMailId) return;
    const selector = `[data-highlight-id="${CSS.escape(highlightedMailId)}"]`;

    const flash = (el: Element) => {
      if (!el.classList.contains('row-flash')) el.classList.add('row-flash');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const find = (): Element | null => {
      for (const el of document.querySelectorAll(selector)) {
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

  const visibleColumns = useMemo(
    () => resolveVisibleColumns(savedColumns, permissions),
    [savedColumns, permissions],
  );

  const handleColumnChange = (columns: MailColumnId[]) => {
    saveColumns.mutate(columns);
  };

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

  const closeDeleteModal = () => {
    setDeleteFor(null);
    setDeleteReason('');
  };

  const confirmDelete = () => {
    if (!deleteFor) return;
    const reason = deleteReason.trim();
    if (!reason) return;
    const mutation = tab === 'incoming' ? deleteIncoming : deleteOutgoing;
    closeDeleteModal();
    mutation.mutate({ id: deleteFor, reason });
  };

  const labelFor = (mailId: string | null): string => {
    if (!mailId) return '';
    const row = rows.find((candidate) => candidate.id === mailId);
    return row?.number || row?.subject || mailId;
  };

  const deleteMailRow = deleteFor ? rows.find((row) => row.id === deleteFor) : undefined;
  const deleteMailSubject = buildDeleteMailSubject(deleteMailRow, deleteFor);

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
      <Stack gap="md">
        <MailSectionHeader
          searchValue={filters.filters.search}
          onSearchChange={(value) => {
            filters.setSearch(value);
            setPage(1);
          }}
          resultCount={rows.length}
          resultTotal={
            isSearchMode ? (activeAll.data?.length ?? 0) : (active.data?.totalItems ?? 0)
          }
          allowedCreateTypes={allowedCreateTypes}
          onOpenColumnSettings={() => setColumnSettingsOpen(true)}
          onCreate={(type) => {
            setFormType(type);
            setFormTarget({ mode: 'create' });
          }}
        />

        <Paper withBorder p="md" style={{ boxShadow: 'var(--mantine-shadow-sm)' }}>
          <MailSectionTable
            orgId={orgId}
            tab={tab}
            setTab={setTab}
            rows={rows}
            visibleColumns={visibleColumns}
            permissions={permissions}
            page={page}
            pageCount={pageCount}
            totalItems={
              isSearchMode ? (activeAll.data?.length ?? 0) : (active.data?.totalItems ?? 0)
            }
            loading={isSearchMode ? activeAll.isLoading : active.isLoading}
            filters={filters}
            objectNames={objectNames}
            responsibleOptions={responsibleOptions}
            chips={chips}
            highlightedMailId={highlightedMailId}
            onPageChange={setPage}
            onOpenFiles={setFilesFor}
            onEdit={(mailId) => {
              setFormType(tab);
              setFormTarget({ mode: 'edit', mailId });
            }}
            onCopy={(mailId) => {
              setFormType(tab);
              setFormTarget({ mode: 'copy', mailId, sourceType: tab });
            }}
            onDelete={setDeleteFor}
            onHistory={setHistoryFor}
            onRelations={(mailId) => setThreadTarget({ mailId, mailType: tab })}
            onResetFilters={filters.resetAll}
          />
        </Paper>
      </Stack>

      <MailSectionModals
        formTarget={formTarget}
        formType={formType}
        editingMail={editingMail}
        allowedCreateTypes={allowedCreateTypes}
        counterpartyOptions={counterpartyOptions}
        candidates={thread.candidates}
        parentEdges={thread.parentEdges}
        canLinkCurrent={formTarget?.mode !== 'edit' ? allowedCreateTypes.includes(formType) : formType === 'incoming' ? permissions.canEditIncoming : permissions.canEditOutgoing}
        saving={saving}
        onCloseForm={() => setFormTarget(null)}
        onTypeChange={setFormType}
        onSave={handleSave}
        onOpenThread={(type, id) => setThreadTarget({ mailId: id, mailType: type })}
        filesFor={filesFor}
        canManageFiles={permissions.canManageFiles}
        historyFor={historyFor}
        createdByName={rows.find((row) => row.id === historyFor)?.createdByName}
        createdAt={rows.find((row) => row.id === historyFor)?.created}
        threadTarget={threadTarget}
        onGoToRegister={(mailId, mailType, dateKey) => {
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
        }}
        visibleColumns={visibleColumns}
        handleColumnChange={handleColumnChange}
        setColumnSettingsOpen={setColumnSettingsOpen}
        columnSettingsOpen={columnSettingsOpen}
        deleteFor={deleteFor}
        deleteIncoming={deleteIncoming}
        deleteOutgoing={deleteOutgoing}
        deleteMailSubject={deleteMailSubject}
        deleteReason={deleteReason}
        closeDeleteModal={closeDeleteModal}
        confirmDelete={confirmDelete}
        setDeleteReason={setDeleteReason}
        setFilesFor={setFilesFor}
        setHistoryFor={setHistoryFor}
        setThreadTarget={setThreadTarget}
        orgId={orgId}
        tab={tab}
        permissions={permissions}
        objectNames={objectNames}
        responsibleOptions={responsibleOptions}
        labelFor={labelFor}
      />
    </>
  );
}
