import { Group, Text } from '@mantine/core';
import { IconMessage, IconPaperclip } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { DocumentColumnId, IDocument, IDocumentComment, IDocumentFile } from '@/shared/types';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { DocumentsTableStatusCell } from './DocumentsTableStatusCell';

/**
 * Рендер ячейки таблицы документов.
 * Возвращает содержимое ячейки по идентификатору колонки; для неизвестной — null.
 */
export function renderDocumentCell(
  id: DocumentColumnId,
  document: IDocument,
  files: IDocumentFile[],
  comments: IDocumentComment[],
) {
  switch (id) {
    case 'seq':
      return (
        <Text size="sm" lineClamp={2} title={String(document.seq ?? '')}>
          {document.seq ?? '—'}
        </Text>
      );
    case 'payment_date':
      return (
        <Text size="sm" lineClamp={2} title={document.payment_date ?? ''}>
          {document.payment_date ? dayjs(document.payment_date).format('DD.MM.YYYY') : '—'}
        </Text>
      );
    case 'counterparty':
      return (
        <Text size="sm" lineClamp={2} title={document.counterparty ?? ''}>
          {document.counterparty || '—'}
        </Text>
      );
    case 'purpose':
      return (
        <Text size="sm" lineClamp={2} title={document.purpose ?? ''}>
          {document.purpose || '—'}
        </Text>
      );
    case 'contract_no':
      return (
        <Text size="sm" lineClamp={2} title={document.contract_no ?? ''}>
          {document.contract_no || '—'}
        </Text>
      );
    case 'invoice_no':
      return (
        <Text size="sm" lineClamp={2} title={document.invoice_no ?? ''}>
          {document.invoice_no || '—'}
        </Text>
      );
    case 'amount':
      return (
        <Text
          size="sm"
          lineClamp={2}
          title={document.amount ? formatAmountRub(document.amount) : ''}
        >
          {document.amount ? formatAmountRub(document.amount) : '—'}
        </Text>
      );
    case 'responsible':
      return (
        <Text size="sm" lineClamp={2} title={document.responsible_name ?? ''}>
          {document.responsible_name || '—'}
        </Text>
      );
    case 'author':
      return (
        <Text size="sm" lineClamp={2} title={document.created_by_name ?? ''}>
          {document.created_by_name || '—'}
        </Text>
      );
    case 'provided':
      return <DocumentsTableStatusCell value={document.provided} label="Предоставлен" />;
    case 'confirmed':
      return <DocumentsTableStatusCell value={document.confirmed} label="Подтверждён" />;
    case 'files':
      return (
        <Group gap={4} justify="center" wrap="nowrap" style={{ cursor: 'pointer' }}>
          <IconPaperclip size={16} />
          <Text size="sm">{files.length}</Text>
        </Group>
      );
    case 'comments':
      return (
        <Group gap={4} justify="center" wrap="nowrap" style={{ cursor: 'pointer' }}>
          <IconMessage size={16} />
          <Text size="sm">{comments.length}</Text>
        </Group>
      );
    case 'source_file':
      return (
        <Text size="sm" lineClamp={2} title={document.source_invoice_no ?? ''}>
          {document.source_invoice_id ? document.source_invoice_no || 'Счёт' : '—'}
        </Text>
      );
    default:
      return null;
  }
}
