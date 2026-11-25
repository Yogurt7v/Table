import { ActionIcon, Text, Tooltip } from '@mantine/core';
import { IconLink } from '@tabler/icons-react';
import { MAIL_DELIVERY_METHOD_EMOJI, MAIL_DELIVERY_METHOD_NAMES } from '@/shared/types';
import type { MailColumnId } from '@/features/mail/model/mail-columns';
import type { MailRow } from '@/features/mail/model/mail-row';
import { COMMENT_EMOJI_FONT_SIZE } from '@/features/mail/model/mail-comment-emojis';
import { MailAttachmentIndicator } from '@/features/mail/ui/indicators/MailAttachmentIndicator';
import { formatMailDate, formatMailTimestamp } from '@/features/mail/model/mail-date';
import {
  MAIL_EMPTY_CELL,
  MAIL_NO_ACCOUNTING_OBJECT_LABEL,
  MAIL_NO_DELIVERY_METHOD_LABEL,
} from '@/features/mail/model/mail-labels';

/** Символы, выделяемые как эмодзи (размер у них свой, текст вокруг — обычный). */
const EMOJI_SPLIT = /(\p{Extended_Pictographic})/gu;
const IS_EMOJI = /\p{Extended_Pictographic}/u;

/** Пропсы ячейки таблицы писем. */
export interface MailTableCellProps {
  id: MailColumnId;
  row: MailRow;
  objectNames: Map<string, string>;
  onOpenFiles: (mailId: string) => void;
  onRelations: (mailId: string) => void;
  actions: React.ReactNode;
}

/**
 * Ячейка таблицы писем.
 * Рендерит содержимое по идентификатору колонки: номер, дату, контрагента,
 * вложения, дату создания, кнопку переписки и меню действий строки.
 */
export function MailTableCell({
  id,
  row,
  objectNames,
  onOpenFiles,
  onRelations,
  actions,
}: MailTableCellProps) {
  // Каждая ветка switch — содержимое одной колонки реестра писем.
  switch (id) {
    case 'seq':
      return <Text size="sm">{row.seq ?? MAIL_EMPTY_CELL}</Text>;
    case 'date':
      return (
        <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
          {formatMailDate(row.dateKey)}
        </Text>
      );
    case 'number':
      return <Text size="sm">{row.number || MAIL_EMPTY_CELL}</Text>;
    case 'counterparty':
      return (
        <Text size="sm" lineClamp={2} fw={600}>
          {row.counterparty}
        </Text>
      );
    case 'counterparty_number':
      return <Text size="sm">{row.counterpartyNumber || MAIL_EMPTY_CELL}</Text>;
    case 'subject':
      return (
        <Text size="sm" lineClamp={5} title={row.comment || row.subject}>
          {row.subject}
        </Text>
      );
    case 'comment': {
      const text = row.comment || MAIL_EMPTY_CELL;
      const parts = text.split(EMOJI_SPLIT);
      return (
        <Text size="sm" lineClamp={5} title={row.comment}>
          {parts.map((part, index) => {
            if (IS_EMOJI.test(part)) {
              return (
                <span
                  key={index}
                  style={{ fontSize: COMMENT_EMOJI_FONT_SIZE, lineHeight: 1 }}
                  role="img"
                >
                  {part}
                </span>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </Text>
      );
    }
    case 'responsible_name':
      return (
        <Text size="sm" lineClamp={2}>
          {row.responsibleName || MAIL_EMPTY_CELL}
        </Text>
      );
    case 'delivery_method':
      return row.deliveryMethod ? (
        <Text
          size="xl"
          role="img"
          aria-label={MAIL_DELIVERY_METHOD_NAMES[row.deliveryMethod]}
          title={MAIL_DELIVERY_METHOD_NAMES[row.deliveryMethod]}
          style={{ whiteSpace: 'nowrap' }}
        >
          {MAIL_DELIVERY_METHOD_EMOJI[row.deliveryMethod]}
        </Text>
      ) : (
        <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {MAIL_NO_DELIVERY_METHOD_LABEL}
        </Text>
      );
    case 'accounting_object_id':
      return row.accountingObjectId ? (
        <Text size="sm" lineClamp={2}>
          {objectNames.get(row.accountingObjectId) ?? MAIL_EMPTY_CELL}
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          {MAIL_NO_ACCOUNTING_OBJECT_LABEL}
        </Text>
      );
    case 'files':
      return (
        <MailAttachmentIndicator
          row={row}
          ariaLabel={`Вложения письма ${row.number || row.id}`}
          onOpenFiles={onOpenFiles}
        />
      );
    case 'created':
      return row.created ? (
        <>
          <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
            {formatMailDate(row.created)}, {formatMailTimestamp(row.created).slice(-5)}
          </Text>
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {row.createdByName ? ` ${row.createdByName}` : ''}
          </Text>
        </>
      ) : (
        <Text size="sm">{MAIL_EMPTY_CELL}</Text>
      );
    case 'thread':
      return (
        <Tooltip label="Переписка">
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            aria-label={`Переписка письма ${row.number || row.id}`}
            onClick={() => onRelations(row.id)}
          >
            <IconLink size={16} />
          </ActionIcon>
        </Tooltip>
      );
    case 'actions':
      return actions;
  }
}
