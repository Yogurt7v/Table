import { ActionIcon, Box, Group, Loader, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { IconLink } from '@tabler/icons-react';
import type { MailType } from '@/shared/types';
import { MailActionsMenu } from './MailActionsMenu';
import { MailAttachmentIndicator } from './MailAttachmentIndicator';
import { MailFiltersReset } from './MailFilters';
import { formatMailDate } from './mail-date';
import { MAIL_DELIVERY_METHOD_EMOJI, MAIL_DELIVERY_METHOD_NAMES } from '@/shared/types';
import {
  MAIL_EMPTY_CELL,
  MAIL_NO_ACCOUNTING_OBJECT_LABEL,
  MAIL_NO_DELIVERY_METHOD_LABEL,
} from './mail-labels';
import type { MailRow } from './mail-row';
import type { MailColumnId } from './mail-columns';
import type { MailPermissions } from './mail-field-access';

interface MailMobileCardsProps {
  rows: MailRow[];
  loading: boolean;
  objectNames: Map<string, string>;
  mailType: MailType;
  permissions: MailPermissions;
  visibleColumns: MailColumnId[];
  emptyHint: string;
  hasFilters: boolean;
  onResetFilters: () => void;
  onOpenFiles: (mailId: string) => void;
  onEdit: (mailId: string) => void;
  onCopy: (mailId: string) => void;
  onDelete: (mailId: string) => void;
  onHistory: (mailId: string) => void;
  onRelations: (mailId: string) => void;
  highlightedMailId?: string | null;
}

/**
 * Карточки писем для узких экранов — та же ветка, что `InvoiceMobileCardView`
 * в реестре счетов: тот же визуальный язык (бумага с границей, жирная тема,
 * приглушённые подписи), но без горизонтальной прокрутки таблицы.
 *
 * Набор полей повторяет `visibleColumns`, иначе настройка колонок врала бы на
 * телефоне: спрятанная «Дата» обязана исчезнуть и из карточки. Порядок колонок
 * здесь не переносится — карточка читается сверху вниз, и у неё нет колонок, —
 * а ширины тем более неприменимы: колонок у неё нет вовсе. Тема остаётся
 * заголовком карточки всегда: карточка без заголовка не карточка, и «Тема» —
 * единственное поле, по которому письмо опознают, не открывая его.
 */
export function MailMobileCards({
  rows,
  loading,
  objectNames,
  mailType,
  permissions,
  visibleColumns,
  emptyHint,
  hasFilters,
  onResetFilters,
  onOpenFiles,
  onEdit,
  onCopy,
  onDelete,
  onHistory,
  onRelations,
}: MailMobileCardsProps) {
  const shows = (id: MailColumnId) => visibleColumns.includes(id);
  const showsSeq = shows('seq');
  const showsDate = shows('date');
  const showsFiles = shows('files');
  const showsResponsible = shows('responsible_name');
  const showsObject = shows('accounting_object_id');
  const showsDelivery = shows('delivery_method');
  const showsCreated = shows('created');
  const showsThread = shows('thread');

  return (
    <Stack hiddenFrom="sm" gap="sm">
      {rows.map((row) => (
        <Paper
          key={row.id}
          withBorder
          radius="sm"
          p="xs"
          style={{
            boxShadow: 'var(--mantine-shadow-sm)',
            borderLeft: '3px solid var(--org-color, #228be6)',
          }}
          data-highlight-id={row.id}
        >
          <Group justify="space-between" wrap="nowrap" gap={4} align="flex-start">
            <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              {showsSeq && (
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {row.seq ?? '·'}
                </Text>
              )}
              {showsDate && (
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {formatMailDate(row.dateKey)}
                </Text>
              )}
            </Group>
            <Group gap={4} wrap="nowrap">
              {showsThread && (
                <Tooltip label="Переписка">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    aria-label="Переписка"
                    onClick={() => onRelations(row.id)}
                  >
                    <IconLink size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
              <MailActionsMenu
                mailId={row.id}
                mailType={mailType}
                compact
                permissions={permissions}
                onEdit={onEdit}
                onCopy={onCopy}
                onDelete={onDelete}
                onHistory={onHistory}
              />
            </Group>
          </Group>

          <Text size="sm" fw={700} lineClamp={2} mt={2}>
            {row.subject}
          </Text>

          {shows('counterparty') && (
            <Text size="sm" lineClamp={2} mt={2}>
              {row.counterparty}
            </Text>
          )}

          <Group gap="xs" mt={2} wrap="wrap">
            {shows('number') && row.number && (
              <Text size="xs" c="dimmed">
                № {row.number}
              </Text>
            )}
            {shows('counterparty_number') && row.counterpartyNumber && (
              <Text size="xs" c="dimmed">
                {row.counterpartyNumber}
              </Text>
            )}
            {showsDelivery && row.deliveryMethod && (
              <Group gap={4}>
                <Text
                  size="xd"
                  component="span"
                  role="img"
                  aria-label={MAIL_DELIVERY_METHOD_NAMES[row.deliveryMethod]}
                  title={MAIL_DELIVERY_METHOD_NAMES[row.deliveryMethod]}
                >
                  {MAIL_DELIVERY_METHOD_EMOJI[row.deliveryMethod]}
                </Text>
              </Group>
            )}
            {showsCreated && row.created && (
              <Text size="xs" c="dimmed">
                Создано: {formatMailDate(row.created)}
              </Text>
            )}
          </Group>

          {showsFiles && (
            <Group gap="xs" mt={2} wrap="wrap">
              <MailAttachmentIndicator
                row={row}
                ariaLabel="Вложения письма"
                onOpenFiles={onOpenFiles}
              />
            </Group>
          )}

          {showsResponsible && (
            <Group gap="xs" mt={2} wrap="wrap">
              <Text size="xs" c="dimmed">
                Ответственный: {row.responsibleName || MAIL_EMPTY_CELL}
              </Text>
            </Group>
          )}

          {showsObject && (
            <Text size="xs" c="dimmed" mt={2}>
              Объект учёта:{' '}
              {row.accountingObjectId
                ? (objectNames.get(row.accountingObjectId) ?? MAIL_EMPTY_CELL)
                : MAIL_NO_ACCOUNTING_OBJECT_LABEL}
            </Text>
          )}

          {showsDelivery && !row.deliveryMethod && (
            <Group gap={4}>
              <Text size="xs" c="dimmed">
                {MAIL_NO_DELIVERY_METHOD_LABEL}
              </Text>
            </Group>
          )}

          {row.comment && (
            <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
              {row.comment}
            </Text>
          )}
        </Paper>
      ))}

      {rows.length === 0 && (
        <Box ta="center" py="xl">
          {loading ? (
            <>
              <Loader size="sm" />
              <Text c="dimmed" mt="xs">
                Загрузка писем…
              </Text>
            </>
          ) : (
            <>
              <Text c="dimmed">{emptyHint}</Text>
              {hasFilters && <MailFiltersReset onReset={onResetFilters} />}
            </>
          )}
        </Box>
      )}
    </Stack>
  );
}
