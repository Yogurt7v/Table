import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useAddDocumentComment,
  useArchiveDocument,
  useDeleteDocumentComment,
  useDeleteDocumentFile,
  useDocument,
  useDocumentComments,
  useDocumentFiles,
  useDocumentHistory,
  useDocumentSource,
  useMarkPaymentCancelled,
  useMoveDocument,
  useUpdateDocument,
  useUpdateDocumentStatus,
  useUploadDocumentFile,
} from '@/features/documents/hooks/useDocuments';
import type { IDocument, IDocumentComment, IDocumentFile } from '@/shared/types';
import { emptyForm } from './document-card-modal-utils';
import type { DocumentCardModalProps, DocumentForm } from './document-card-modal-types';

/**
 * Логика карточки документа: запросы документа и его вкладок, мутации,
 * состояние формы редактирования, права по роли и обработчики действий.
 */
export function useDocumentCardModal({
  documentId,
  opened,
  onClose,
  organizationId,
  role,
  currentUserId,
  objects,
  users,
  initialTab = 'document',
}: DocumentCardModalProps) {
  // Запросы: сам документ и данные четырёх вкладок
  const documentQuery = useDocument(documentId);
  const document = documentQuery.data;
  const filesQuery = useDocumentFiles(documentId ?? undefined);
  const commentsQuery = useDocumentComments(documentId ?? undefined);
  const historyQuery = useDocumentHistory(documentId ?? undefined);
  const sourceQuery = useDocumentSource(document ?? null);

  // Мутации действий над документом
  const updateDocument = useUpdateDocument(organizationId);
  const updateStatus = useUpdateDocumentStatus(organizationId);
  const uploadFile = useUploadDocumentFile(organizationId);
  const deleteFile = useDeleteDocumentFile(organizationId);
  const addComment = useAddDocumentComment(organizationId);
  const removeComment = useDeleteDocumentComment(organizationId);
  const archiveDocument = useArchiveDocument(organizationId);
  const moveDocument = useMoveDocument(organizationId);
  const markCancelled = useMarkPaymentCancelled(organizationId);

  // Состояние модалки: вкладка, редактирование реквизитов, подтверждения и черновики
  const [tab, setTab] = useState<string | null>(initialTab);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DocumentForm | null>(null);
  const [reason, setReason] = useState('');
  const [archiveOpened, setArchiveOpened] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<IDocumentFile | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<IDocumentComment | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (!document) return;
    // The modal is reused for different rows, so its editable copy must be
    // rebuilt when the selected document changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(emptyForm(document));
    setEditing(false);
    setTab(initialTab);
    setReason('');
    setSelectedFiles([]);
    setCommentText('');
  }, [document, initialTab]);

  const isAdmin = role === 'admin' || role === 'moderator';
  const isBoss = role === 'boss';
  const isResponsible = !!document && document.responsible_id === currentUserId;
  const canEdit = !!document && !isBoss && (isAdmin || isResponsible) && !document.is_deleted;
  const canEditPaymentDate = canEdit && isAdmin;
  const canEditResponsible = canEdit && isAdmin;
  const canMove = !!document && !isBoss && role !== 'guest' && !document.is_deleted;
  const canToggleProvided = canEdit && isAdmin;
  const canToggleConfirmed = canEdit && isAdmin;
  const canArchive = !!document && isAdmin && !document.is_deleted;
  const canComment = !!document && !isBoss && (isAdmin || isResponsible) && !document.is_deleted;
  const canDeleteComment = !!document && isAdmin;
  const canUpload = !!document && !isBoss && (isAdmin || isResponsible) && !document.is_deleted;

  const userOptions = useMemo(
    () => users.map((user) => ({ value: user.id, label: user.name || user.login || user.email })),
    [users],
  );
  const objectOptions = useMemo(
    () => objects.map((object) => ({ value: object.id, label: object.name })),
    [objects],
  );

  // Данные вкладок с дефолтами, чтобы рендер не ждал загрузки
  const files = filesQuery.data ?? [];
  const comments = commentsQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const source = sourceQuery.data ?? null;
  const completed = !!document && document.provided && document.confirmed;

  const patchForm = (patch: Partial<DocumentForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
  };

  /** Отмена правки: форма сбрасывается к исходным реквизитам документа. */
  const handleCancelEdit = () => {
    if (!document) return;
    setForm(emptyForm(document));
    setEditing(false);
  };

  const handleSave = async () => {
    if (!document || !form) return;
    const objectChanged = form.accounting_object_id !== document.accounting_object_id;
    const data: Partial<IDocument> = {};
    const changes: Array<{ field: string; from: unknown; to: unknown; from_label?: string; to_label?: string }> = [];

    if (canEdit) {
      if (form.counterparty !== document.counterparty) {
        data.counterparty = form.counterparty;
        changes.push({ field: 'counterparty', from: document.counterparty, to: form.counterparty });
      }
      if (form.purpose !== document.purpose) {
        data.purpose = form.purpose;
        changes.push({ field: 'purpose', from: document.purpose, to: form.purpose });
      }
      if (form.contract_no !== document.contract_no) {
        data.contract_no = form.contract_no;
        changes.push({ field: 'contract_no', from: document.contract_no, to: form.contract_no });
      }
      if (form.invoice_no !== document.invoice_no) {
        data.invoice_no = form.invoice_no;
        changes.push({ field: 'invoice_no', from: document.invoice_no, to: form.invoice_no });
      }
      if (form.amount !== document.amount) {
        data.amount = form.amount;
        changes.push({ field: 'amount', from: document.amount, to: form.amount });
      }
    }
    if (canEditPaymentDate && form.payment_date !== document.payment_date) {
      data.payment_date = form.payment_date;
      changes.push({ field: 'payment_date', from: document.payment_date, to: form.payment_date });
    }
    if (canEditResponsible && form.responsible_id !== document.responsible_id) {
      data.responsible_id = form.responsible_id;
      const selected = users.find((user) => user.id === form.responsible_id);
      const toLabel = selected?.name || selected?.login || selected?.email || '';
      data.responsible_name = toLabel;
      changes.push({
        field: 'responsible_id',
        from: document.responsible_id,
        to: form.responsible_id,
        from_label: document.responsible_name || '',
        to_label: toLabel,
      });
    }

    try {
      if (objectChanged) {
        const fromObject = objects.find((o) => o.id === document.accounting_object_id);
        const toObject = objects.find((o) => o.id === form.accounting_object_id);
        await moveDocument.mutateAsync({
          document,
          accountingObjectId: form.accounting_object_id,
          labels: { fromObjectName: fromObject?.name, toObjectName: toObject?.name },
        });
      }
      if (Object.keys(data).length > 0) {
        const type = changes.length === 1 && changes[0]?.field === 'responsible_id'
          ? 'responsible_changed'
          : 'document_updated';
        const current = objectChanged ? { ...document, accounting_object_id: form.accounting_object_id } : document;
        await updateDocument.mutateAsync({
          document: current,
          data,
          type,
          previousData: { v: 2, source: 'ui', changes, meta: {} },
        });
      }
      setEditing(false);
      notifications.show({ color: 'green', message: 'Документ сохранён' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось сохранить документ' });
    }
  };

  const handleStatus = async (field: 'provided' | 'confirmed') => {
    if (!document) return;
    try {
      await updateStatus.mutateAsync({ document, [field]: !document[field] });
      notifications.show({ color: 'green', message: 'Статус обновлён' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось изменить статус' });
    }
  };

  const handleUpload = async () => {
    if (!document || selectedFiles.length === 0) return;
    const failed: File[] = [];
    let uploaded = 0;
    for (const file of selectedFiles) {
      try {
        await uploadFile.mutateAsync({ document, file });
        uploaded += 1;
      } catch {
        failed.push(file);
      }
    }
    // Неудачные файлы остаются в очереди: их можно повторить, не выбирая заново.
    setSelectedFiles(failed);
    if (uploaded > 0) {
      notifications.show({
        color: 'green',
        message: uploaded === 1 ? 'Файл загружен' : `Загружено файлов: ${uploaded}`,
      });
    }
    if (failed.length > 0) {
      notifications.show({
        color: 'red',
        message: `Не удалось загрузить файл: ${failed.map((file) => file.name).join(', ')}`,
      });
    }
  };

  const handleDeleteFile = async () => {
    if (!document || !fileToDelete) return;
    try {
      await deleteFile.mutateAsync({ document, file: fileToDelete });
      setFileToDelete(null);
      notifications.show({ color: 'green', message: 'Файл удалён' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось удалить файл' });
    }
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!document || !text) return;
    try {
      await addComment.mutateAsync({ document, text });
      setCommentText('');
      notifications.show({ color: 'green', message: 'Комментарий добавлен' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось добавить комментарий' });
    }
  };

  const handleDeleteComment = async () => {
    if (!document || !commentToDelete) return;
    try {
      await removeComment.mutateAsync({ document, comment: commentToDelete });
      setCommentToDelete(null);
      notifications.show({ color: 'green', message: 'Комментарий удалён' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось удалить комментарий' });
    }
  };

  const handleArchive = async () => {
    if (!document || !reason.trim()) return;
    try {
      await archiveDocument.mutateAsync({ document, reason: reason.trim() });
      setArchiveOpened(false);
      notifications.show({ color: 'green', message: 'Документ перемещён в архив' });
      onClose();
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось переместить документ в архив' });
    }
  };

  const handlePaymentCancelled = async () => {
    if (!document) return;
    try {
      await markCancelled.mutateAsync({
        document,
        cancelled: !document.payment_cancelled,
      });
      notifications.show({
        color: 'green',
        message: document.payment_cancelled ? 'Оплата возобновлена' : 'Оплата отменена',
      });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось изменить статус оплаты' });
    }
  };

  // Удаление файла: админ всегда, ответственный — только свой и только до подтверждения
  const canDeleteFile = (file: IDocumentFile) =>
    !!document &&
    (isAdmin || (isResponsible && file.uploaded_by === currentUserId && !document.confirmed));

  return {
    opened,
    onClose,
    tab,
    setTab,
    documentQuery,
    filesQuery,
    commentsQuery,
    historyQuery,
    sourceQuery,
    document,
    form,
    files,
    comments,
    history,
    source,
    completed,
    editing,
    setEditing,
    reason,
    setReason,
    archiveOpened,
    setArchiveOpened,
    fileToDelete,
    setFileToDelete,
    commentToDelete,
    setCommentToDelete,
    selectedFiles,
    setSelectedFiles,
    commentText,
    setCommentText,
    isAdmin,
    canEdit,
    canEditPaymentDate,
    canEditResponsible,
    canMove,
    canToggleProvided,
    canToggleConfirmed,
    canArchive,
    canComment,
    canDeleteComment,
    canUpload,
    canDeleteFile,
    userOptions,
    objectOptions,
    updateDocument,
    updateStatus,
    uploadFile,
    deleteFile,
    addComment,
    removeComment,
    archiveDocument,
    moveDocument,
    markCancelled,
    patchForm,
    handleCancelEdit,
    handleSave,
    handleStatus,
    handleUpload,
    handleDeleteFile,
    handleAddComment,
    handleDeleteComment,
    handleArchive,
    handlePaymentCancelled,
  };
}
