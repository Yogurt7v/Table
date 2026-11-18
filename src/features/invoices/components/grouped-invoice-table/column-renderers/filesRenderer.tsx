import { ActionIcon, Anchor, FileButton, Stack, Text, Tooltip } from '@mantine/core';
import { IconPaperclip } from '@tabler/icons-react';
import { getInvoiceFileUrl } from '@/api/collections';
import { shortenFileName } from '@/shared/utils/shorten-file-name';
import type { GroupedInvoiceTableColumnRenderersParams, InvoiceColumnRenderer } from './types';

/** Рендерер колонки файлов: список вложений и кнопка прикрепления в черновике. */
export function createFilesColumnRenderer(
  params: Pick<
    GroupedInvoiceTableColumnRenderersParams,
    'filesByInvoice' | 'draftForm' | 'onDraftChange'
  >,
): InvoiceColumnRenderer {
  const { filesByInvoice, draftForm, onDraftChange } = params;

  // Рендерер колонки «Файлы»: вложения + кнопка прикрепления в черновике
  return {
    width: 40,
    header: 'Файлы',
    renderCell: (invoice) => {
      const invoiceFiles = filesByInvoice?.[invoice.id];
      if (invoiceFiles?.length) {
        return (
          <Stack gap={2}>
            {invoiceFiles.map((f) => (
              <Anchor
                key={f.id}
                href={getInvoiceFileUrl(f)}
                target="_blank"
                rel="noopener noreferrer"
                size="xs"
              >
                {shortenFileName(f.name)}
              </Anchor>
            ))}
          </Stack>
        );
      }
      return (
        <Text size="xs" c="dimmed">
          —
        </Text>
      );
    },
    renderDraft: () => (
      <FileButton onChange={(v) => onDraftChange?.('file', v)}>
        {(props) => (
          <Tooltip label={draftForm?.file?.name ?? 'Прикрепить файл'}>
            <ActionIcon
              {...props}
              variant={draftForm?.file ? 'light' : 'subtle'}
              color={draftForm?.file ? 'blue' : 'gray'}
              size="sm"
            >
              <IconPaperclip size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </FileButton>
    ),
  };
}
