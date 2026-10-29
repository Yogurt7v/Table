import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { IconCheck, IconPaperclip, IconMessage, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { DocumentColumnId, IDocument, IDocumentComment, IDocumentFile } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';

interface DocumentMobileCardsProps {
  documents: IDocument[];
  visibleColumns: DocumentColumnId[];
  filesByDocument: Record<string, IDocumentFile[]>;
  commentsByDocument: Record<string, IDocumentComment[]>;
  onOpenDocument: (document: IDocument) => void;
  highlightDocumentId?: string | null;
}

function StatusCell({ value, label }: { value: boolean; label: string }) {
  return value ? (
    <IconCheck size={18} color="var(--mantine-color-green-6)" aria-label={label} />
  ) : (
    <IconX size={18} color="var(--mantine-color-gray-5)" aria-label={`Не ${label.toLowerCase()}`} />
  );
}

export function DocumentMobileCards({
  documents,
  visibleColumns,
  filesByDocument,
  commentsByDocument,
  onOpenDocument,
  highlightDocumentId,
}: DocumentMobileCardsProps) {
  const shows = (id: DocumentColumnId) => visibleColumns.includes(id);

  return (
    <Stack gap="sm">
      {documents.map((document) => {
        const completed = document.provided && document.confirmed;
        const isHighlighted = Boolean(highlightDocumentId && document.id === highlightDocumentId);
        const files = filesByDocument[document.id] ?? [];
        const comments = commentsByDocument[document.id] ?? [];

        return (
          <Paper
            key={document.id}
            withBorder
            radius="sm"
            p="xs"
            onClick={() => onOpenDocument(document)}
            style={{
              boxShadow: 'var(--mantine-shadow-sm)',
              borderLeft: '3px solid var(--org-color, #228be6)',
              backgroundColor: isHighlighted
                ? 'var(--mantine-color-blue-0)'
                : completed
                  ? 'var(--mantine-color-gray-1)'
                  : undefined,
              cursor: 'pointer',
            }}
            data-document-id={document.id}
          >
            <Group justify="space-between" wrap="nowrap" gap={4} align="flex-start" mb="xs">
              <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                {shows('seq') && (
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {document.seq ?? '·'}
                  </Text>
                )}
                {shows('payment_date') && (
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {document.payment_date ? dayjs(document.payment_date).format('DD.MM.YYYY') : '—'}
                  </Text>
                )}
              </Group>
            </Group>

            {shows('counterparty') && (
              <Text size="sm" fw={700} lineClamp={2} title={document.counterparty ?? ''} mt="xs">
                {document.counterparty || '—'}
              </Text>
            )}

            {shows('purpose') && (
              <Text size="sm" lineClamp={2} title={document.purpose ?? ''} mt="xs">
                {document.purpose || '—'}
              </Text>
            )}

            <Group gap="xs" mt="xs" wrap="wrap">
              {shows('invoice_no') && document.invoice_no && (
                <Text size="xs" c="dimmed">Счёт {document.invoice_no}</Text>
              )}
              {shows('amount') && document.amount && (
                <Text size="xs" c="dimmed">{formatAmountRub(document.amount)}</Text>
              )}
            </Group>

            <Group gap="xs" mt="xs" wrap="wrap">
              {shows('files') && files.length > 0 && (
                <Group gap={4}>
                  <IconPaperclip size={16} />
                  <Text size="xs" c="dimmed">{files.length}</Text>
                </Group>
              )}
              {shows('comments') && comments.length > 0 && (
                <Group gap={4}>
                  <IconMessage size={16} />
                  <Text size="xs" c="dimmed">{comments.length}</Text>
                </Group>
              )}
            </Group>

            {shows('provided') && (
              <Group gap="xs" mt="xs" wrap="wrap">
                <StatusCell value={document.provided} label="Предоставлен" />
              </Group>
            )}
            {shows('confirmed') && (
              <Group gap="xs" mt="xs" wrap="wrap">
                <StatusCell value={document.confirmed} label="Подтверждён" />
              </Group>
            )}
          </Paper>
        );
      })}

      {documents.length === 0 && (
        <Box ta="center" py="xl">
          <Text c="dimmed">Документов не найдено</Text>
        </Box>
      )}
    </Stack>
  );
}
