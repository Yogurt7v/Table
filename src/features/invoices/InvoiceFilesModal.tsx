import { Modal, Stack, Text, Group, ActionIcon, FileButton, Button, Loader } from '@mantine/core';
import { IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { getInvoiceFiles, getInvoiceFileUrl } from '@/api/collections';
import { useCreateInvoiceFile, useDeleteInvoiceFile } from '@/shared/hooks/useInvoiceFiles';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type { IInvoiceFile } from '@/shared/types';

interface InvoiceFilesModalProps {
  invoiceId: string | null;
  invoiceLabel: string;
  orgId: string;
  opened: boolean;
  canManageFiles: boolean;
  onClose: () => void;
}

export function InvoiceFilesModal({
  invoiceId,
  invoiceLabel,
  orgId,
  opened,
  canManageFiles,
  onClose,
}: InvoiceFilesModalProps) {
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [fileToDelete, setFileToDelete] = useState<IInvoiceFile | null>(null);

  const { data: files, isLoading } = useQuery({
    queryKey: ['invoice_files_detail', invoiceId],
    queryFn: () => getInvoiceFiles(invoiceId!),
    enabled: opened && !!invoiceId,
  });

  const createFile = useCreateInvoiceFile(orgId);
  const deleteFile = useDeleteInvoiceFile(orgId);

  const handleUpload = async () => {
    if (!fileToUpload || !invoiceId) return;
    try {
      await createFile.mutateAsync({
        invoiceId,
        file: fileToUpload,
        name: fileToUpload.name,
      });
      setFileToUpload(null);
      notifications.show({ color: 'green', message: 'Файл загружен' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось загрузить файл' });
    }
  };

  const handleDelete = async (fileRecord: IInvoiceFile) => {
    setFileToDelete(null);
    try {
      await deleteFile.mutateAsync(fileRecord);
      notifications.show({ color: 'green', message: 'Файл удалён' });
    } catch {
      notifications.show({ color: 'red', message: 'Не удалось удалить файл' });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Файлы: ${invoiceLabel}`}
      size="md"
    >
      {isLoading ? (
        <Loader size="sm" />
      ) : !files?.length ? (
        <Text c="dimmed" mb="md">Файлов нет</Text>
      ) : (
        <Stack gap="sm" mb="md">
          {files.map((f) => (
            <Group key={f.id} gap="sm" wrap="nowrap">
              <a
                href={getInvoiceFileUrl(f)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {f.name}
              </a>
              {canManageFiles && (
                <ActionIcon
                  size="sm"
                  color="red"
                  variant="subtle"
                  aria-label="Удалить файл"
                  onClick={() => setFileToDelete(f)}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              )}
            </Group>
          ))}
        </Stack>
      )}

      {canManageFiles && (
        <Stack gap="xs">
          <FileButton onChange={setFileToUpload}>
            {(props) => (
              <Button
                {...props}
                variant="default"
                leftSection={<IconUpload size={14} />}
                disabled={createFile.isPending}
                fullWidth
              >
                Выбрать файл
              </Button>
            )}
          </FileButton>

          {fileToUpload && (
            <Group gap="xs" wrap="nowrap">
              <Text
                size="sm"
                style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {fileToUpload.name}
              </Text>
              <ActionIcon
                size="sm"
                color="red"
                variant="subtle"
                aria-label="Снять выбор файла"
                onClick={() => setFileToUpload(null)}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          )}

          <Button
            leftSection={<IconUpload size={14} />}
            disabled={!fileToUpload}
            loading={createFile.isPending}
            onClick={handleUpload}
            fullWidth
          >
            Загрузить
          </Button>
        </Stack>
      )}

      <ConfirmModal
        opened={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={() => {
          if (fileToDelete) handleDelete(fileToDelete);
        }}
        title="Удаление файла"
        message={`Удалить файл «${fileToDelete?.name ?? ''}»?`}
      />
    </Modal>
  );
}
