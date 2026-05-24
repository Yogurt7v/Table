import { Modal, Stack, Text, Group, ActionIcon, FileInput, Button, Loader } from '@mantine/core';
import { IconTrash, IconUpload } from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { getInvoiceFiles, getInvoiceFileUrl, deleteInvoiceFile } from '@/api/collections';
import { useCreateInvoiceFile } from '@/shared/hooks/useInvoiceFiles';
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

  const { data: files, isLoading } = useQuery({
    queryKey: ['invoice_files_detail', invoiceId],
    queryFn: () => getInvoiceFiles(invoiceId!),
    enabled: opened && !!invoiceId,
  });

  const createFile = useCreateInvoiceFile(orgId);

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
    try {
      await deleteInvoiceFile(fileRecord.id);
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
                  onClick={() => handleDelete(f)}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              )}
            </Group>
          ))}
        </Stack>
      )}

      {canManageFiles && (
        <Group gap="sm" align="flex-end">
          <FileInput
            value={fileToUpload}
            onChange={setFileToUpload}
            placeholder="Выберите файл"
            clearable
            style={{ flex: 1 }}
          />
          <Button
            size="sm"
            leftSection={<IconUpload size={14} />}
            disabled={!fileToUpload}
            loading={createFile.isPending}
            onClick={handleUpload}
          >
            Добавить
          </Button>
        </Group>
      )}
    </Modal>
  );
}
