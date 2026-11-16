import { useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useCreateIncomingMail,
  useCreateOutgoingMail,
  useDeleteIncomingMail,
  useDeleteOutgoingMail,
  useIncomingMail,
  useOutgoingMail,
  useUpdateIncomingMail,
  useUpdateOutgoingMail,
} from '@/shared/hooks/useMail';
import { useMailLinkChange } from '@/features/mail/useMailLinkChange';
import { candidateByKey, parentEdgesOf, planLinkChange } from '@/features/mail/mail-parent';
import { mailNodeKey } from '@/features/mail/mail-thread';
import type { MailNodeKey } from '@/features/mail/mail-thread';
import { MAIL_TYPE_LABELS } from '@/features/mail/mail-labels';
import { computeRegisterTarget } from '@/features/mail/mail-register-target';
import { useOrgCounterparties } from '@/features/mail/useOrgCounterparties';
import { snapshotForHistory, type MailFormState } from '@/features/mail/mail-form';
import { buildDeleteMailSubject } from './delete-mail-subject';
import type { MailFormTarget, MailThreadTarget } from './mail-section-types';
import type { MailSectionData } from './useMailSectionData';
import type { IIncomingMail, IOutgoingMail, MailType } from '@/shared/types';

/**
 * Состояние и действия раздела писем: форма, файлы, история, дерево
 * переписки, настройка колонок, удаление письма и переход в реестр.
 *
 * Данные реестра приходят из `useMailSectionData` — действия над строками
 * (сохранение, удаление, связи) требуют тех же прав и тех же строк.
 */
export function useMailSectionActions(
  orgId: string,
  tab: MailType,
  setTab: (tab: MailType) => void,
  data: MailSectionData,
  requestHighlight: (mailId: string) => void,
) {
  const { permissions, thread, filters, rows, responsibleNames, setPage } = data;
  const linkChange = useMailLinkChange(orgId);

  const [formTarget, setFormTarget] = useState<MailFormTarget | null>(null);
  const [formType, setFormType] = useState<MailType>('incoming');
  const [filesFor, setFilesFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [threadTarget, setThreadTarget] = useState<MailThreadTarget | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // Подсказки контрагентов нужны, пока открыта форма: словарь качается по
  // требованию, а не при каждом открытии `/mail`.
  const { counterpartyOptions } = useOrgCounterparties(orgId, formTarget !== null);

  /**
   * Детали спрашиваются только пока активный регистр тот же, в котором письмо
   * лежит. Переключение регистра в режиме копии оставляет `formType` не тем,
   * что был при открытии, а `sourceType` — тем: письмо осталось в прежней
   * коллекции, и его id в новой не существует. Создание не спрашивает ничего,
   * а правка регистр не переключает, так что там id остаётся всегда.
   */
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

  /**
   * Право назвать или снять родителя — то самое, что уже спрашивает кнопка
   * редактирования: создать письмо даёт `canCreate*`, изменить — `canEdit*`.
   * Ровно тот же список флагов, а не роль: роль в почте не решает ничего.
   */
  const canLinkCurrent =
    formTarget?.mode !== 'edit'
      ? data.allowedCreateTypes.includes(formType)
      : formType === 'incoming'
        ? permissions.canEditIncoming
        : permissions.canEditOutgoing;

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

  /**
   * Запись связи в `mail_relations` — строго после успешного сохранения письма.
   * Наоборот нельзя: связь, созданная до неудачного сохранения, пережила бы его
   * откат и осталась бы у письма с прежними полями.
   *
   * Что именно писать, решает `planLinkChange`, и он смотрит только на
   * сохранённые рёбра: `null` — значит человек назвал того же родителя, и запись
   * не нужна. **Номер контрагента в этом решении не участвует вовсе** — правка
   * номера не пишет связь, потому что сюда приходит лишь тот родитель, кого
   * человек назвал сам.
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

  // Письма нет в `rows`, если страница перелисталась, — карточка тогда молча
  // деградирует до одной строки-заглушки и ничего не выдумывает.
  const deleteMailRow = deleteFor ? rows.find((row) => row.id === deleteFor) : undefined;
  const deleteMailSubject = useMemo(
    () => buildDeleteMailSubject(deleteMailRow, deleteFor),
    [deleteMailRow, deleteFor],
  );

  return {
    formTarget,
    setFormTarget,
    formType,
    setFormType,
    filesFor,
    setFilesFor,
    historyFor,
    setHistoryFor,
    threadTarget,
    setThreadTarget,
    columnSettingsOpen,
    setColumnSettingsOpen,
    deleteFor,
    setDeleteFor,
    deleteReason,
    setDeleteReason,
    counterpartyOptions,
    editingMail,
    saving,
    canLinkCurrent,
    deleteIncoming,
    deleteOutgoing,
    deleteMailSubject,
    handleGoToRegister,
    handleSave,
    closeDeleteModal,
    confirmDelete,
    labelFor,
  };
}
