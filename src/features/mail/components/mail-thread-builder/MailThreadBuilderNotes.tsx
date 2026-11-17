import { Alert, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { THREAD_MAX_DEPTH } from '@/features/mail/mail-thread';
import {
  MAIL_CHAIN_CYCLE_NOTE,
  MAIL_CHAIN_TRUNCATION_NOTE,
  MAIL_DETACHED_LETTER_NOTE,
} from '@/features/mail/mail-thread-labels';

/** Пропсы пояснений под линией писем. */
export interface MailThreadBuilderNotesProps {
  hasCycle: boolean;
  hasDetached: boolean;
  skipped: number;
}

/**
 * Пояснения под линией писем.
 * Рендерит предупреждение о кольце, пометку о снятом последним сбросом письме
 * и пометку об обрезанной глубине.
 */
export function MailThreadBuilderNotes({
  hasCycle,
  hasDetached,
  skipped,
}: MailThreadBuilderNotesProps) {
  return (
    <>
      {/* Предупреждение о кольце в цепочке */}
      {hasCycle && (
        <Alert
          color="yellow"
          variant="light"
          icon={<IconAlertTriangle size={16} />}
          title="Цепочка замыкается в кольцо"
        >
          <Text size="xs">{MAIL_CHAIN_CYCLE_NOTE}</Text>
        </Alert>
      )}

      {/* Письмо, снятое последним сбросом */}
      {hasDetached && (
        <Text size="xs" c="dimmed">
          {MAIL_DETACHED_LETTER_NOTE}
        </Text>
      )}

      {/* Часть цепочки не поместилась из-за предела глубины */}
      {skipped > 0 && (
        <Text size="xs" c="dimmed">
          {MAIL_CHAIN_TRUNCATION_NOTE(THREAD_MAX_DEPTH)}
        </Text>
      )}
    </>
  );
}
