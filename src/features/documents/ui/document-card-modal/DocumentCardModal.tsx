import {
  Alert,
  Badge,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Tabs,
  Textarea,
  Title,
} from '@mantine/core';
import { IconFile, IconHistory, IconMessage, IconPaperclip } from '@tabler/icons-react';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { DocumentCardModalActions } from './DocumentCardModalActions';
import { DocumentCardModalComments } from './DocumentCardModalComments';
import { DocumentCardModalFiles } from './DocumentCardModalFiles';
import { DocumentCardModalHistory } from './DocumentCardModalHistory';
import { DocumentCardModalRequisites } from './DocumentCardModalRequisites';
import { DocumentCardModalSource } from './DocumentCardModalSource';
import { DocumentCardModalStatus } from './DocumentCardModalStatus';
import { useDocumentCardModal } from './useDocumentCardModal';
import type { DocumentCardModalProps } from './document-card-modal-types';

/**
 * Карточ документа: вкладки «Документ», «Файлы», «Комментарии», «История»
 * и подтверждения удаления/архива. Состояние и обработчики — в `useDocumentCardModal`.
 */
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
  const ctx = useDocumentCardModal({
    documentId,
    opened,
    onClose,
    organizationId,
    role,
    currentUserId,
    objects,
    users,
    initialTab,
  });

  if (!opened) return null;

  if (ctx.documentQuery.isLoading) {
    return (
      <Modal opened={opened} onClose={onClose} title="Документ" size="xl">
        <Center py="xl">
          <Loader />
        </Center>
      </Modal>
    );
  }

  if (!ctx.document || !ctx.form) {
    return (
      <Modal opened={opened} onClose={onClose} title="Документ" size="xl">
        <Alert color="red">Документ не найден</Alert>
      </Modal>
    );
  }

  const { document, form } = ctx;

  // Окно с заголовком-бейджами, вкладками и подтверждениями
  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="sm" wrap="wrap">
            <Title order={4}>Документ №{document.seq}</Title>
            {ctx.completed && (
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
        <Tabs value={ctx.tab} onChange={ctx.setTab}>
          {/* Переключатель вкладок с счётчиками файлов и комментариев */}
          <Tabs.List>
            <Tabs.Tab value="document" leftSection={<IconFile size={14} />}>
              Документ
            </Tabs.Tab>
            <Tabs.Tab value="files" leftSection={<IconPaperclip size={14} />}>
              Файлы {ctx.files.length > 0 ? ctx.files.length : ''}
            </Tabs.Tab>
            <Tabs.Tab value="comments" leftSection={<IconMessage size={14} />}>
              Комментарии {ctx.comments.length > 0 ? ctx.comments.length : ''}
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>
              История
            </Tabs.Tab>
          </Tabs.List>

          {/* Вкладка «Документ»: статусы, реквизиты, исходный счёт, действия */}
          <Tabs.Panel value="document" pt="md">
            <Stack gap="md">
              <DocumentCardModalStatus
                document={document}
                canToggleProvided={ctx.canToggleProvided}
                canToggleConfirmed={ctx.canToggleConfirmed}
                statusPending={ctx.updateStatus.isPending}
                onToggle={ctx.handleStatus}
              />

              <DocumentCardModalRequisites
                document={document}
                form={form}
                editing={ctx.editing}
                canEdit={ctx.canEdit}
                canEditPaymentDate={ctx.canEditPaymentDate}
                canEditResponsible={ctx.canEditResponsible}
                canMove={ctx.canMove}
                objectOptions={ctx.objectOptions}
                userOptions={ctx.userOptions}
                saving={ctx.updateDocument.isPending || ctx.moveDocument.isPending}
                onPatch={ctx.patchForm}
                onStartEdit={() => ctx.setEditing(true)}
                onCancelEdit={ctx.handleCancelEdit}
                onSave={ctx.handleSave}
              />

              {document.source_invoice_id && (
                <DocumentCardModalSource source={ctx.source} loading={ctx.sourceQuery.isLoading} />
              )}

              <DocumentCardModalActions
                document={document}
                canArchive={ctx.canArchive}
                isAdmin={ctx.isAdmin}
                cancelling={ctx.markCancelled.isPending}
                onArchive={() => ctx.setArchiveOpened(true)}
                onTogglePaymentCancelled={ctx.handlePaymentCancelled}
              />
            </Stack>
          </Tabs.Panel>

          {/* Вкладка «Файлы» */}
          <Tabs.Panel value="files" pt="md">
            <DocumentCardModalFiles
              document={document}
              files={ctx.files}
              loading={ctx.filesQuery.isLoading}
              canUpload={ctx.canUpload}
              canDeleteFile={ctx.canDeleteFile}
              selectedFiles={ctx.selectedFiles}
              uploading={ctx.uploadFile.isPending}
              onFilesChange={ctx.setSelectedFiles}
              onRequestDelete={ctx.setFileToDelete}
              onUpload={ctx.handleUpload}
            />
          </Tabs.Panel>

          {/* Вкладка «Комментарии» */}
          <Tabs.Panel value="comments" pt="md">
            <DocumentCardModalComments
              comments={ctx.comments}
              loading={ctx.commentsQuery.isLoading}
              canComment={ctx.canComment}
              canDeleteComment={ctx.canDeleteComment}
              commentText={ctx.commentText}
              adding={ctx.addComment.isPending}
              onCommentTextChange={ctx.setCommentText}
              onAdd={ctx.handleAddComment}
              onRequestDelete={ctx.setCommentToDelete}
            />
          </Tabs.Panel>

          {/* Вкладка «История» */}
          <Tabs.Panel value="history" pt="md">
            <DocumentCardModalHistory history={ctx.history} loading={ctx.historyQuery.isLoading} />
          </Tabs.Panel>
        </Tabs>
      </Modal>

      {/* Подтверждение архивации с причиной */}
      <ConfirmModal
        opened={ctx.archiveOpened}
        onClose={() => ctx.setArchiveOpened(false)}
        onConfirm={ctx.handleArchive}
        title="Переместить документ в архив"
        confirmLabel="В архив"
        color="orange"
        loading={ctx.archiveDocument.isPending}
        confirmDisabled={!ctx.reason.trim()}
        message="Документ можно будет восстановить из архива документов."
      >
        <Textarea
          label="Причина"
          value={ctx.reason}
          onChange={(event) => ctx.setReason(event.currentTarget.value)}
          required
          autosize
          minRows={2}
        />
      </ConfirmModal>

      {/* Подтверждение удаления файла */}
      <ConfirmModal
        opened={!!ctx.fileToDelete}
        onClose={() => ctx.setFileToDelete(null)}
        onConfirm={ctx.handleDeleteFile}
        title="Удаление файла"
        message={`Удалить файл «${ctx.fileToDelete?.name ?? ''}»?`}
        loading={ctx.deleteFile.isPending}
      />

      {/* Подтверждение удаления комментария */}
      <ConfirmModal
        opened={!!ctx.commentToDelete}
        onClose={() => ctx.setCommentToDelete(null)}
        onConfirm={ctx.handleDeleteComment}
        title="Удаление комментария"
        message="Комментарий будет удалён из документа."
        loading={ctx.removeComment.isPending}
      />
    </>
  );
}
