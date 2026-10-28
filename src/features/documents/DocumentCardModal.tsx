import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Divider,
  FileButton,
  Grid,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconArchive,
  IconFile,
  IconMessage,
  IconPaperclip,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
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
} from '@/shared/hooks/useDocuments';
import { getDocumentFileUrl } from '@/api/documents';
import { dateKeyToLocalDate, localDateToDateKey } from '@/features/mail/mail-date';
import type {
  IAccountingObject,
  IDocument,
  IDocumentComment,
  IDocumentFile,
  IUser,
} from '@/shared/types';
import type { OrgRole } from '@/features/invoices/invoice-field-access';

interface DocumentCardModalProps {
  documentId: string | null;
  opened: boolean;
  onClose: () => void;
  organizationId: string;
  role: OrgRole;
  currentUserId: string | undefined;
  objects: IAccountingObject[];
  users: IUser[];
}

interface DocumentForm {
  accounting_object_id: string;
  payment_date: string;
  counterparty: string;
  purpose: string;
  contract_no: string;
  invoice_no: string;
  amount: number;
  responsible_id: string;
}

const HISTORY_LABELS: Record<string, string> = {
  document_created: 'Документ создан вручную',
  document_auto_created: 'Документ создан автоматически',
  document_updated: 'Документ изменён',
  document_synced: 'Данные синхронизированы со счётом',
  file_added: 'Файл добавлен',
  file_removed: 'Файл удалён',
  comment_added: 'Комментарий добавлен',
  comment_deleted: 'Комментарий удалён',
  status_changed: 'Изменены статусы',
  responsible_changed: 'Изменён ответственный',
  object_changed: 'Изменён объект',
  document_archived: 'Документ перемещён в архив',
  document_restored: 'Документ восстановлен',
  payment_cancelled: 'Оплата отменена',
  payment_resumed: 'Оплата возобновлена',
};

function emptyForm(document: IDocument): DocumentForm {
  return {
    accounting_object_id: document.accounting_object_id,
    payment_date: document.payment_date,
    counterparty: document.counterparty,
    purpose: document.purpose,
    contract_no: document.contract_no,
    invoice_no: document.invoice_no,
    amount: document.amount,
    responsible_id: document.responsible_id,
  };
}

const DOCUMENT_FIELD_LABELS: Record<string, string> = {
  amount: 'Сумма',
  counterparty: 'Контрагент',
  purpose: 'Назначение',
  contract_no: 'Договор',
  invoice_no: 'Номер счёта',
  payment_date: 'Дата оплаты',
  responsible_id: 'Ответственный',
  accounting_object_id: 'Объект учёта',
  source_invoice_no: 'Номер счёта',
  provided: 'Предоставлен',
  confirmed: 'Подтверждён',
  payment_cancelled: 'Оплата отменена',
  payment_resumed: 'Оплата возобновлена',
  deletion_reason: 'Причина удаления',
};

const HIDDEN_FIELDS = new Set([
  'source_invoice_id',
  'automatic',
  'is_deleted',
  'file_id',
]);

function formatDocumentHistoryValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (key === 'amount') {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('ru-RU') + ' ₽' : String(value);
  }
  if (key === 'provided') return value === true ? 'да' : 'нет';
  if (key === 'confirmed') return value === true ? 'да' : 'нет';
  if (key === 'payment_cancelled') return value === true ? 'да' : 'нет';
  if (key === 'payment_resumed') return value === true ? 'да' : 'нет';
  if (key === 'payment_date') return String(value);
  return String(value);
}

function historyDetails(data: Record<string, unknown>, type?: string): string {
  if (!data || Object.keys(data).length === 0) return '';
  const lines: string[] = [];
  if (data['automatic'] === true) {
    lines.push('Документ создан автоматически');
  }
  // События файлов: показываем просто имя файла вместо сырых полей.
  if ((type === 'file_added' || type === 'file_removed') && data['name']) {
    lines.push(`Файл «${String(data['name'])}»`);
    return lines.join('\n');
  }
  for (const [key, value] of Object.entries(data)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    const label = DOCUMENT_FIELD_LABELS[key] ?? key;
    lines.push(`${label}: ${formatDocumentHistoryValue(key, value)}`);
  }
  return lines.join('\n');
}

export function DocumentCardModal({
  documentId,
  opened,
  onClose,
  organizationId,
  role,
  currentUserId,
  objects,
  users,
}: DocumentCardModalProps) {
  const documentQuery = useDocument(documentId);
  const document = documentQuery.data;
  const filesQuery = useDocumentFiles(documentId ?? undefined);
  const commentsQuery = useDocumentComments(documentId ?? undefined);
  const historyQuery = useDocumentHistory(documentId ?? undefined);
  const sourceQuery = useDocumentSource(document ?? null);

  const updateDocument = useUpdateDocument(organizationId);
  const updateStatus = useUpdateDocumentStatus(organizationId);
  const uploadFile = useUploadDocumentFile(organizationId);
  const deleteFile = useDeleteDocumentFile(organizationId);
  const addComment = useAddDocumentComment(organizationId);
  const removeComment = useDeleteDocumentComment(organizationId);
  const archiveDocument = useArchiveDocument(organizationId);
  const moveDocument = useMoveDocument(organizationId);
  const markCancelled = useMarkPaymentCancelled(organizationId);

  const [tab, setTab] = useState<string | null>('document');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DocumentForm | null>(null);
  const [reason, setReason] = useState('');
  const [archiveOpened, setArchiveOpened] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<IDocumentFile | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<IDocumentComment | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (!document) return;
    // The modal is reused for different rows, so its editable copy must be
    // rebuilt when the selected document changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(emptyForm(document));
    setEditing(false);
    setTab('document');
    setReason('');
    setSelectedFile(null);
    setCommentText('');
  }, [document]);

  const isAdmin = role === 'admin' || role === 'moderator';
  const isBoss = role === 'boss';
  const isResponsible = !!document && document.responsible_id === currentUserId;
  const canEdit = !!document && !isBoss && (isAdmin || isResponsible) && !document.is_deleted;
  const canEditPaymentDate = canEdit && isAdmin;
  const canEditResponsible = canEdit && isAdmin;
  const canMove = canEdit;
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

  if (!opened) return null;

  if (documentQuery.isLoading) {
    return (
      <Modal opened={opened} onClose={onClose} title="Документ" size="xl">
        <Loader />
      </Modal>
    );
  }

  if (!document || !form) {
    return (
      <Modal opened={opened} onClose={onClose} title="Документ" size="xl">
        <Alert color="red">Документ не найден</Alert>
      </Modal>
    );
  }

  const files = filesQuery.data ?? [];
  const comments = commentsQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const source = sourceQuery.data ?? null;
  const completed = document.provided && document.confirmed;

  const patchForm = (patch: Partial<DocumentForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
  };

  const handleSave = async () => {
    if (!form) return;
    const objectChanged = form.accounting_object_id !== document.accounting_object_id;
    const data: Partial<IDocument> = {};

    if (canEdit) {
      if (form.counterparty !== document.counterparty) data.counterparty = form.counterparty;
      if (form.purpose !== document.purpose) data.purpose = form.purpose;
      if (form.contract_no !== document.contract_no) data.contract_no = form.contract_no;
      if (form.invoice_no !== document.invoice_no) data.invoice_no = form.invoice_no;
      if (form.amount !== document.amount) data.amount = form.amount;
    }
    if (canEditPaymentDate && form.payment_date !== document.payment_date) {
      data.payment_date = form.payment_date;
    }
    if (canEditResponsible && form.responsible_id !== document.responsible_id) {
      data.responsible_id = form.responsible_id;
      const selected = users.find((user) => user.id === form.responsible_id);
      data.responsible_name = selected?.name || selected?.login || selected?.email || '';
    }

    try {
      if (objectChanged) {
        await moveDocument.mutateAsync({
          document,
          accountingObjectId: form.accounting_object_id,
        });
      }
      if (Object.keys(data).length > 0) {
        await updateDocument.mutateAsync({
          document,
          data,
          previousData: {
            payment_date: document.payment_date,
            counterparty: document.counterparty,
            purpose: document.purpose,
            contract_no: document.contract_no,
            invoice_no: document.invoice_no,
            amount: document.amount,
            responsible_id: document.responsible_id,
          },
        });
      }
      setEditing(false);
      notifications.show({ color: 'green', message: 'Документ сохранён' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось сохранить документ' });
    }
  };

  const handleStatus = async (field: 'provided' | 'confirmed') => {
    try {
      await updateStatus.mutateAsync({ document, [field]: !document[field] });
      notifications.show({ color: 'green', message: 'Статус обновлён' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось изменить статус' });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await uploadFile.mutateAsync({ document, file: selectedFile });
      setSelectedFile(null);
      notifications.show({ color: 'green', message: 'Файл загружен' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось загрузить файл' });
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
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
    if (!text) return;
    try {
      await addComment.mutateAsync({ document, text });
      setCommentText('');
      notifications.show({ color: 'green', message: 'Комментарий добавлен' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось добавить комментарий' });
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete) return;
    try {
      await removeComment.mutateAsync({ document, comment: commentToDelete });
      setCommentToDelete(null);
      notifications.show({ color: 'green', message: 'Комментарий удалён' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось удалить комментарий' });
    }
  };

  const handleArchive = async () => {
    if (!reason.trim()) return;
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

  const canDeleteFile = (file: IDocumentFile) =>
    isAdmin || (isResponsible && file.uploaded_by === currentUserId && !document.confirmed);

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="xs">
            <Title order={4}>Документ №{document.seq}</Title>
            {completed && <Badge color="gray">Отработан</Badge>}
            {document.payment_cancelled && <Badge color="red">Оплата отменена</Badge>}
            {document.is_deleted && <Badge color="orange">В архиве</Badge>}
          </Group>
        }
        size="xl"
      >
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="document">Документ</Tabs.Tab>
            <Tabs.Tab value="files" leftSection={<IconPaperclip size={14} />}>
              Файлы {files.length > 0 ? files.length : ''}
            </Tabs.Tab>
            <Tabs.Tab value="comments" leftSection={<IconMessage size={14} />}>
              Комментарии {comments.length > 0 ? comments.length : ''}
            </Tabs.Tab>
            <Tabs.Tab value="history">История</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="document" pt="md">
            <Stack gap="md">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Контрагент"
                    value={form.counterparty}
                    onChange={(event) => patchForm({ counterparty: event.currentTarget.value })}
                    readOnly={!editing || !canEdit}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput
                    label="Договор"
                    value={form.contract_no}
                    onChange={(event) => patchForm({ contract_no: event.currentTarget.value })}
                    readOnly={!editing || !canEdit}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <TextInput
                    label="Счёт №"
                    value={form.invoice_no}
                    onChange={(event) => patchForm({ invoice_no: event.currentTarget.value })}
                    readOnly={!editing || !canEdit}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Объект"
                    data={objectOptions}
                    value={form.accounting_object_id}
                    onChange={(value) => value && patchForm({ accounting_object_id: value })}
                    disabled={!editing || !canMove}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <DatePickerInput
                    label="Дата оплаты"
                    valueFormat="DD.MM.YYYY"
                    value={dateKeyToLocalDate(form.payment_date)}
                    onChange={(value) => patchForm({ payment_date: localDateToDateKey(value) })}
                    disabled={!editing || !canEditPaymentDate}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 3 }}>
                  <NumberInput
                    label="Сумма"
                    value={form.amount}
                    onChange={(value) => patchForm({ amount: typeof value === 'number' ? value : 0 })}
                    readOnly={!editing || !canEdit}
                    min={0}
                    decimalScale={2}
                    thousandSeparator=" "
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Ответственный"
                    data={userOptions}
                    value={form.responsible_id}
                    onChange={(value) => value && patchForm({ responsible_id: value })}
                    disabled={!editing || !canEditResponsible}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput label="Автор" value={document.created_by_name || '—'} readOnly />
                </Grid.Col>
                <Grid.Col span={12}>
                  <Textarea
                    label="Назначение"
                    value={form.purpose}
                    onChange={(event) => patchForm({ purpose: event.currentTarget.value })}
                    readOnly={!editing || !canEdit}
                    autosize
                    minRows={2}
                    maxRows={5}
                  />
                </Grid.Col>
              </Grid>

              <Group>
                {canEdit && !editing && (
                  <Button variant="light" onClick={() => setEditing(true)}>
                    Редактировать
                  </Button>
                )}
                {editing && (
                  <>
                    <Button onClick={handleSave} loading={updateDocument.isPending || moveDocument.isPending}>
                      Сохранить
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => {
                        setForm(emptyForm(document));
                        setEditing(false);
                      }}
                    >
                      Отмена
                    </Button>
                  </>
                )}
              </Group>

              <Divider label="Статусы" labelPosition="left" />
              <Group>
                <Checkbox
                  label="Предоставлен"
                  checked={document.provided}
                  disabled={!canToggleProvided || updateStatus.isPending}
                  onChange={() => handleStatus('provided')}
                />
                <Checkbox
                  label="Подтверждён"
                  checked={document.confirmed}
                  disabled={!canToggleConfirmed || !document.provided || updateStatus.isPending}
                  onChange={() => handleStatus('confirmed')}
                />
                {document.confirmed_file_id && (
                  <Badge variant="light" color="green">
                    Файл подтверждения выбран
                  </Badge>
                )}
              </Group>

              {document.source_invoice_id && (
                <>
                  <Divider label="Исходный счёт" labelPosition="left" />
                  {sourceQuery.isLoading ? (
                    <Loader size="sm" />
                  ) : source ? (
                    <Paper withBorder p="sm">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm">
                            Счёт №{source.invoiceNo || '—'} · {source.counterparty}
                          </Text>
                          {source.deleted && <Badge color="red">Счёт удалён</Badge>}
                        </Group>
                        <Text size="sm" c="dimmed">
                          {source.amount.toLocaleString('ru-RU')} ₽
                        </Text>
                        {source.files.length === 0 ? (
                          <Text size="sm" c="dimmed">
                            Файлов счёта нет
                          </Text>
                        ) : (
                          source.files.map((file) => (
                            <Anchor key={file.id} href={file.url} target="_blank" rel="noreferrer" size="sm">
                              <Group gap={4}>
                                <IconFile size={14} />
                                {file.name}
                              </Group>
                            </Anchor>
                          ))
                        )}
                      </Stack>
                    </Paper>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Исходный счёт не найден
                    </Text>
                  )}
                </>
              )}

              <Divider />
              <Group justify="space-between">
                <Group>
                  {canArchive && (
                    <Button
                      color="orange"
                      variant="light"
                      leftSection={<IconArchive size={16} />}
                      onClick={() => setArchiveOpened(true)}
                    >
                      В архив
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      color={document.payment_cancelled ? 'green' : 'red'}
                      variant="light"
                      leftSection={<IconRefresh size={16} />}
                      onClick={handlePaymentCancelled}
                      loading={markCancelled.isPending}
                    >
                      {document.payment_cancelled ? 'Возобновить оплату' : 'Отменить оплату'}
                    </Button>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  Создан {document.created ? dayjs(document.created).format('DD.MM.YYYY HH:mm') : '—'}
                </Text>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="files" pt="md">
            <Stack gap="md">
              {filesQuery.isLoading ? (
                <Loader size="sm" />
              ) : files.length === 0 ? (
                <Text c="dimmed">Файлов нет</Text>
              ) : (
                files.map((file) => (
                  <Paper key={file.id} withBorder p="xs">
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                        <IconFile size={18} />
                        <Anchor href={getDocumentFileUrl(file)} target="_blank" rel="noreferrer" size="sm">
                          <Text size="sm" truncate>
                            {file.name}
                          </Text>
                        </Anchor>
                        {file.id === document.confirmed_file_id && (
                          <Badge size="xs" color="green">
                            Подтверждающий
                          </Badge>
                        )}
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <Text size="xs" c="dimmed">
                          {file.uploaded_by_name || '—'}
                        </Text>
                        {canDeleteFile(file) && (
                          <Tooltip label="Удалить файл">
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              aria-label="Удалить файл"
                              onClick={() => setFileToDelete(file)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Group>
                  </Paper>
                ))
              )}

              {canUpload && (
                <Stack gap="xs">
                  <FileButton onChange={setSelectedFile}>
                    {(props) => (
                      <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
                        Выбрать файл
                      </Button>
                    )}
                  </FileButton>
                  {selectedFile && (
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
                        {selectedFile.name}
                      </Text>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Снять выбор файла"
                        onClick={() => setSelectedFile(null)}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Group>
                  )}
                  <Button
                    leftSection={<IconUpload size={16} />}
                    disabled={!selectedFile}
                    loading={uploadFile.isPending}
                    onClick={handleUpload}
                  >
                    Загрузить
                  </Button>
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="comments" pt="md">
            <Stack gap="md">
              {canComment && (
                <Stack gap="xs">
                  <Textarea
                    label="Новый комментарий"
                    value={commentText}
                    onChange={(event) => setCommentText(event.currentTarget.value)}
                    autosize
                    minRows={2}
                    maxRows={5}
                  />
                  <Button
                    onClick={handleAddComment}
                    loading={addComment.isPending}
                    disabled={!commentText.trim()}
                  >
                    Добавить комментарий
                  </Button>
                </Stack>
              )}

              {commentsQuery.isLoading ? (
                <Loader size="sm" />
              ) : comments.length === 0 ? (
                <Text c="dimmed">Комментариев нет</Text>
              ) : (
                comments.map((comment) => (
                  <Paper key={comment.id} withBorder p="sm">
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" fw={500}>
                        {comment.author_name || 'Пользователь'}
                      </Text>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">
                          {comment.created ? dayjs(comment.created).format('DD.MM.YYYY HH:mm') : ''}
                        </Text>
                        {canDeleteComment && (
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            aria-label="Удалить комментарий"
                            onClick={() => setCommentToDelete(comment)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Group>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {comment.text}
                    </Text>
                  </Paper>
                ))
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="md">
            {historyQuery.isLoading ? (
              <Loader size="sm" />
            ) : history.length === 0 ? (
              <Text c="dimmed">История пуста</Text>
            ) : (
              <ScrollArea.Autosize mah={520}>
                <Stack gap="xs">
                  {history.map((record) => {
                    const details = historyDetails(record.previous_data, record.type);
                    return (
                      <Paper key={record.id} withBorder p="xs">
                        <Group justify="space-between" mb={4}>
                          <Text size="sm" fw={500}>
                            {HISTORY_LABELS[record.type] || record.type || 'Изменение'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {record.changed_at ? dayjs(record.changed_at).format('DD.MM.YYYY HH:mm') : ''}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {record.author_name || 'Система'}
                        </Text>
                        {details && (
                          <ScrollArea mt={4} mah={160}>
                            <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap' }}>
                              {details}
                            </Text>
                          </ScrollArea>
                        )}
                      </Paper>
                    );
                  })}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Tabs.Panel>
        </Tabs>
      </Modal>

      <ConfirmModal
        opened={archiveOpened}
        onClose={() => setArchiveOpened(false)}
        onConfirm={handleArchive}
        title="Переместить документ в архив"
        confirmLabel="В архив"
        color="orange"
        loading={archiveDocument.isPending}
        confirmDisabled={!reason.trim()}
        message="Документ можно будет восстановить из архива документов."
      >
        <Textarea
          label="Причина"
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          required
          autosize
          minRows={2}
        />
      </ConfirmModal>

      <ConfirmModal
        opened={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleDeleteFile}
        title="Удаление файла"
        message={`Удалить файл «${fileToDelete?.name ?? ''}»?`}
        loading={deleteFile.isPending}
      />

      <ConfirmModal
        opened={!!commentToDelete}
        onClose={() => setCommentToDelete(null)}
        onConfirm={handleDeleteComment}
        title="Удаление комментария"
        message="Комментарий будет удалён из документа."
        loading={removeComment.isPending}
      />
    </>
  );
}
