import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
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
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconArchive,
  IconCheck,
  IconCircleCheck,
  IconDeviceFloppy,
  IconFile,
  IconHistory,
  IconMessage,
  IconMessageCircle,
  IconPaperclip,
  IconPencil,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconUser,
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
  initialTab?: 'document' | 'files' | 'comments' | 'history';
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

// Круг с крестиком внутри — нарисован вручную, без внешних библиотек иконок.
function IconCircleCross({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </svg>
  );
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
  initialTab = 'document',
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

  const [tab, setTab] = useState<string | null>(initialTab);
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
    setTab(initialTab);
    setReason('');
    setSelectedFile(null);
    setCommentText('');
  }, [document, initialTab]);

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
        <Center py="xl">
          <Loader />
        </Center>
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
          <Group gap="sm" wrap="wrap">
            <Title order={4}>Документ №{document.seq}</Title>
            {completed && (
              <Badge color="green" variant="light">
                Отработан
              </Badge>
            )}
            {document.payment_cancelled && (
              <Badge color="red" variant="light">
                Оплата отменена
              </Badge>
            )}
            {document.is_deleted && (
              <Badge color="orange" variant="light">
                В архиве
              </Badge>
            )}
          </Group>
        }
        size="xl"
      >
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="document" leftSection={<IconFile size={14} />}>
              Документ
            </Tabs.Tab>
            <Tabs.Tab value="files" leftSection={<IconPaperclip size={14} />}>
              Файлы {files.length > 0 ? files.length : ''}
            </Tabs.Tab>
            <Tabs.Tab value="comments" leftSection={<IconMessage size={14} />}>
              Комментарии {comments.length > 0 ? comments.length : ''}
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>
              История
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="document" pt="md">
            <Stack gap="md">
              {/* ПРОМИНЕНТНЫЙ БЛОК СТАТУСОВ — статусные карточки */}
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={8}>
                  Статус документа
                </Text>
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Paper
                      withBorder
                      radius="md"
                      p="md"
                      onClick={
                        canToggleProvided && !updateStatus.isPending
                          ? () => handleStatus('provided')
                          : undefined
                      }
                      style={{
                        borderColor: document.provided
                          ? 'var(--mantine-color-green-5)'
                          : 'var(--mantine-color-orange-4)',
                        backgroundColor: document.provided
                          ? 'var(--mantine-color-green-0)'
                          : 'var(--mantine-color-orange-0)',
                        cursor:
                          canToggleProvided && !updateStatus.isPending
                            ? 'pointer'
                            : 'default',
                      }}
                    >
                      <Group gap="md" wrap="nowrap" align="center">
                        <ThemeIcon
                          size={56}
                          radius="xl"
                          variant={document.provided ? 'filled' : 'light'}
                          color={document.provided ? 'green' : 'orange'}
                        >
                          {document.provided ? (
                            <IconCircleCheck size={34} />
                          ) : (
                            <IconCircleCross size={34} />
                          )}
                        </ThemeIcon>
                        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Предоставлен
                          </Text>
                          <Text
                            size="xl"
                            fw={700}
                            c={document.provided ? 'green.9' : 'orange.9'}
                          >
                            {document.provided ? 'Да' : 'Нет'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {canToggleProvided
                              ? 'Нажмите, чтобы изменить'
                              : document.provided
                                ? 'Документ предоставлен'
                                : 'Документ ещё не предоставлен'}
                          </Text>
                        </Stack>
                      </Group>
                    </Paper>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Paper
                      withBorder
                      radius="md"
                      p="md"
                      onClick={
                        canToggleConfirmed && document.provided && !updateStatus.isPending
                          ? () => handleStatus('confirmed')
                          : undefined
                      }
                      style={{
                        borderColor: document.confirmed
                          ? 'var(--mantine-color-green-5)'
                          : document.provided
                            ? 'var(--mantine-color-orange-4)'
                            : 'var(--mantine-color-gray-3)',
                        backgroundColor: document.confirmed
                          ? 'var(--mantine-color-green-0)'
                          : document.provided
                            ? 'var(--mantine-color-orange-0)'
                            : 'var(--mantine-color-gray-0)',
                        cursor:
                          canToggleConfirmed && !updateStatus.isPending
                            ? document.provided
                              ? 'pointer'
                              : 'not-allowed'
                            : 'default',
                        opacity: !document.provided ? 0.65 : 1,
                      }}
                    >
                      <Group gap="md" wrap="nowrap" align="center">
                        <ThemeIcon
                          size={56}
                          radius="xl"
                          variant={document.confirmed ? 'filled' : 'light'}
                          color={
                            document.confirmed
                              ? 'green'
                              : document.provided
                                ? 'orange'
                                : 'gray'
                          }
                        >
                          {document.confirmed ? (
                            <IconCircleCheck size={34} />
                          ) : (
                            <IconCircleCross size={34} />
                          )}
                        </ThemeIcon>
                        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Подтверждён
                          </Text>
                          <Text
                            size="xl"
                            fw={700}
                            c={
                              document.confirmed
                                ? 'green.9'
                                : document.provided
                                  ? 'orange.9'
                                  : 'gray.6'
                            }
                          >
                            {document.confirmed ? 'Да' : 'Нет'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {!document.provided
                              ? 'Сначала отметьте «Предоставлен»'
                              : canToggleConfirmed
                                ? 'Нажмите, чтобы изменить'
                                : document.confirmed
                                  ? 'Документ подтверждён'
                                  : 'Документ ещё не подтверждён'}
                          </Text>
                        </Stack>
                      </Group>
                    </Paper>
                  </Grid.Col>
                </Grid>
                {document.confirmed_file_id && (
                  <Group gap="xs" mt="sm">
                    <ThemeIcon size="sm" variant="light" color="green" radius="xl">
                      <IconCheck size={12} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed">
                      Файл подтверждения выбран
                    </Text>
                  </Group>
                )}
              </Box>

              {/* РЕКВИЗИТЫ — вторичный блок */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={editing ? { borderColor: 'var(--mantine-color-blue-4)' } : undefined}
              >
                <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
                  <Text fw={600} size="sm" c="dimmed" tt="uppercase">
                    Реквизиты
                  </Text>
                  {canEdit && !editing && (
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconPencil size={14} />}
                      onClick={() => setEditing(true)}
                    >
                      Редактировать
                    </Button>
                  )}
                  {editing && (
                    <Group gap="xs">
                      <Button
                        size="xs"
                        leftSection={<IconDeviceFloppy size={14} />}
                        onClick={handleSave}
                        loading={updateDocument.isPending || moveDocument.isPending}
                      >
                        Сохранить
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        leftSection={<IconX size={14} />}
                        onClick={() => {
                          setForm(emptyForm(document));
                          setEditing(false);
                        }}
                      >
                        Отмена
                      </Button>
                    </Group>
                  )}
                </Group>
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Контрагент"
                      value={form.counterparty}
                      onChange={(event) =>
                        patchForm({ counterparty: event.currentTarget.value })
                      }
                      readOnly={!editing || !canEdit}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    <TextInput
                      label="Договор"
                      value={form.contract_no}
                      onChange={(event) =>
                        patchForm({ contract_no: event.currentTarget.value })
                      }
                      readOnly={!editing || !canEdit}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    <TextInput
                      label="Счёт №"
                      value={form.invoice_no}
                      onChange={(event) =>
                        patchForm({ invoice_no: event.currentTarget.value })
                      }
                      readOnly={!editing || !canEdit}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Объект"
                      data={objectOptions}
                      value={form.accounting_object_id}
                      onChange={(value) =>
                        value && patchForm({ accounting_object_id: value })
                      }
                      disabled={!editing || !canMove}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    <DatePickerInput
                      label="Дата оплаты"
                      valueFormat="DD.MM.YYYY"
                      value={dateKeyToLocalDate(form.payment_date)}
                      onChange={(value) =>
                        patchForm({ payment_date: localDateToDateKey(value) })
                      }
                      disabled={!editing || !canEditPaymentDate}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    <NumberInput
                      label="Сумма"
                      value={form.amount}
                      onChange={(value) =>
                        patchForm({ amount: typeof value === 'number' ? value : 0 })
                      }
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
                      onChange={(value) =>
                        value && patchForm({ responsible_id: value })
                      }
                      disabled={!editing || !canEditResponsible}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Автор"
                      value={document.created_by_name || '—'}
                      readOnly
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label="Назначение"
                      value={form.purpose}
                      onChange={(event) =>
                        patchForm({ purpose: event.currentTarget.value })
                      }
                      readOnly={!editing || !canEdit}
                      autosize
                      minRows={2}
                      maxRows={5}
                    />
                  </Grid.Col>
                </Grid>
              </Paper>

              {document.source_invoice_id && (
                <Paper withBorder p="md" radius="md">
                  <Text fw={600} size="sm" c="dimmed" tt="uppercase" mb="sm">
                    Исходный счёт
                  </Text>
                  {sourceQuery.isLoading ? (
                    <Loader size="sm" />
                  ) : source ? (
                    <Stack gap="xs">
                      <Group justify="space-between" wrap="wrap">
                        <Text size="sm" fw={500}>
                          Счёт №{source.invoiceNo || '—'} · {source.counterparty}
                        </Text>
                        {source.deleted && (
                          <Badge color="red" variant="light">
                            Счёт удалён
                          </Badge>
                        )}
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
                          <Anchor
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            size="sm"
                          >
                            <Group gap={6} wrap="nowrap">
                              <IconFile size={14} />
                              <Text size="sm" truncate>
                                {file.name}
                              </Text>
                            </Group>
                          </Anchor>
                        ))
                      )}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Исходный счёт не найден
                    </Text>
                  )}
                </Paper>
              )}

              <Paper withBorder p="md" radius="md">
                <Group justify="space-between" wrap="wrap" gap="md">
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
                        {document.payment_cancelled
                          ? 'Возобновить оплату'
                          : 'Отменить оплату'}
                      </Button>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    Создан{' '}
                    {document.created
                      ? dayjs(document.created).format('DD.MM.YYYY HH:mm')
                      : '—'}
                  </Text>
                </Group>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="files" pt="md">
            <Stack gap="md">
              {filesQuery.isLoading ? (
                <Loader size="sm" />
              ) : files.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
                      <IconPaperclip size={24} />
                    </ThemeIcon>
                    <Text c="dimmed" size="sm">
                      Файлов нет
                    </Text>
                  </Stack>
                </Center>
              ) : (
                files.map((file) => (
                  <Paper key={file.id} withBorder p="sm" radius="md">
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                        <ThemeIcon size="md" variant="light" color="blue" radius="md">
                          <IconFile size={16} />
                        </ThemeIcon>
                        <Stack gap={2} style={{ minWidth: 0 }}>
                          <Anchor
                            href={getDocumentFileUrl(file)}
                            target="_blank"
                            rel="noreferrer"
                            size="sm"
                          >
                            <Text size="sm" fw={500} truncate>
                              {file.name}
                            </Text>
                          </Anchor>
                          <Group gap="xs" wrap="wrap">
                            <Text size="xs" c="dimmed">
                              {file.uploaded_by_name || '—'}
                            </Text>
                            {file.id === document.confirmed_file_id && (
                              <Badge size="xs" color="green" variant="light">
                                Подтверждающий
                              </Badge>
                            )}
                          </Group>
                        </Stack>
                      </Group>
                      <Group gap="xs" wrap="nowrap">
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
                <Paper withBorder p="md" radius="md">
                  <Stack gap="xs">
                    <FileButton onChange={setSelectedFile}>
                      {(props) => (
                        <Button
                          {...props}
                          variant="default"
                          leftSection={<IconUpload size={16} />}
                        >
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
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="comments" pt="md">
            <Stack gap="md">
              {canComment && (
                <Paper withBorder p="md" radius="md">
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
                </Paper>
              )}

              {commentsQuery.isLoading ? (
                <Loader size="sm" />
              ) : comments.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
                      <IconMessageCircle size={24} />
                    </ThemeIcon>
                    <Text c="dimmed" size="sm">
                      Комментариев нет
                    </Text>
                  </Stack>
                </Center>
              ) : (
                comments.map((comment) => (
                  <Paper key={comment.id} withBorder p="sm" radius="md">
                    <Group justify="space-between" mb="xs" align="flex-start" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon variant="light" radius="xl" size="md" color="blue">
                          <IconUser size={14} />
                        </ThemeIcon>
                        <Stack gap={0}>
                          <Text size="sm" fw={500}>
                            {comment.author_name || 'Пользователь'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {comment.created
                              ? dayjs(comment.created).format('DD.MM.YYYY HH:mm')
                              : ''}
                          </Text>
                        </Stack>
                      </Group>
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
              <Center py="xl">
                <Stack align="center" gap="xs">
                  <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
                    <IconHistory size={24} />
                  </ThemeIcon>
                  <Text c="dimmed" size="sm">
                    История пуста
                  </Text>
                </Stack>
              </Center>
            ) : (
              <ScrollArea.Autosize mah={520}>
                <Stack gap="xs">
                  {history.map((record) => {
                    const details = historyDetails(record.previous_data, record.type);
                    return (
                      <Paper key={record.id} withBorder p="sm" radius="md">
                        <Group justify="space-between" mb={4} align="flex-start" wrap="nowrap">
                          <Stack gap={2} style={{ minWidth: 0 }}>
                            <Text size="sm" fw={500}>
                              {HISTORY_LABELS[record.type] || record.type || 'Изменение'}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {record.author_name || 'Система'}
                            </Text>
                          </Stack>
                          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                            {record.changed_at
                              ? dayjs(record.changed_at).format('DD.MM.YYYY HH:mm')
                              : ''}
                          </Text>
                        </Group>
                        {details && (
                          <ScrollArea mt={6} mah={160}>
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
