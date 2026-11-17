import { Paper, Text } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Формирует ReactNode-карточку удаляемого письма для модального окна.
 * Показывает тему, номер, контрагента и дату, если доступны.
 */
export function buildDeleteMailSubject(
  deleteMailRow:
    | {
        number: string;
        counterparty: string;
        dateKey: string;
        subject: string;
      }
    | undefined,
  deleteFor: string | null,
): ReactNode {
  if (!deleteFor) return null;
  const meta = deleteMailRow
    ? [
        deleteMailRow.number ? `№ ${deleteMailRow.number}` : null,
        deleteMailRow.counterparty || null,
      ].filter((part): part is string => Boolean(part))
    : [];
  return (
    <>
      {/* Карточка удаляемого письма: тема, номер, контрагент и дата */}
      <Paper withBorder radius="md" p="sm">
        <Text fw={600} lh={1.35} lineClamp={2}>
          {deleteMailRow?.subject || deleteMailRow?.number || deleteMailRow?.counterparty || '—'}
        </Text>
        {meta.length > 0 && (
          <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
            {meta.join(' · ')}
          </Text>
        )}
      </Paper>
    </>
  );
}
