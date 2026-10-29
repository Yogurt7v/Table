import { Box, Group, Modal, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';
import type { IDeletedIncomingMail, IDeletedOutgoingMail, MailType } from '@/shared/types';
import { MAIL_TYPE_LABELS } from '@/features/mail/mail-labels';

type DeletedMail = IDeletedIncomingMail | IDeletedOutgoingMail;

interface DeletedMailDetailModalProps {
  mail: DeletedMail | null;
  mailType: MailType;
  objectName: string;
  opened: boolean;
  onClose: () => void;
}

function numberOf(mail: DeletedMail, mailType: MailType): string {
  return mailType === 'incoming'
    ? ((mail as IDeletedIncomingMail).number ?? '')
    : (mail as IDeletedOutgoingMail).outgoing_number;
}

function counterpartyOf(mail: DeletedMail, mailType: MailType): string {
  return mailType === 'incoming'
    ? (mail as IDeletedIncomingMail).sender
    : (mail as IDeletedOutgoingMail).recipient;
}

export function DeletedMailDetailModal({
  mail,
  mailType,
  objectName,
  opened,
  onClose,
}: DeletedMailDetailModalProps) {
  if (!mail) return null;

  const label = `${MAIL_TYPE_LABELS[mailType]} № ${numberOf(mail, mailType) || mail.id}`;

  return (
    <Modal opened={opened} onClose={onClose} title={label} size="lg">
      <Stack gap="xs">
        <Row label="Тип" value={MAIL_TYPE_LABELS[mailType]} />
        <Row label="Номер" value={numberOf(mail, mailType) || '—'} />
        <Row
          label="Дата"
          value={mail.date ? dayjs(mail.date).format('DD.MM.YYYY') : '—'}
        />
        <Row label="Контрагент" value={counterpartyOf(mail, mailType) || '—'} />
        <Row label="Тема" value={mail.subject || '—'} />
        <Row label="Комментарий" value={mail.comment || '—'} />
        <Row label="Объект учёта" value={objectName || '—'} />

        <Box mt="sm" p="sm" style={deletionBoxStyle}>
          <Stack gap={4}>
            <Text size="xs" fw={600} c="red">
              Удалён
            </Text>
            <Text size="xs" c="dimmed">
              Кто:{' '}
              <Text component="span" c="dark.6">
                {mail.deleted_by_name || 'Неизвестно'}
              </Text>
            </Text>
            <Text size="xs" c="dimmed">
              Когда:{' '}
              <Text component="span" c="dark.6">
                {mail.deleted_at ? dayjs(mail.deleted_at).format('DD.MM.YYYY HH:mm') : '—'}
              </Text>
            </Text>
          </Stack>
        </Box>
      </Stack>
    </Modal>
  );
}

const deletionBoxStyle = {
  borderRadius: 6,
  background: 'var(--mantine-color-red-0)',
  border: '1px solid var(--mantine-color-red-2)',
} as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Text size="sm" c="dimmed" w={130}>
        {label}
      </Text>
      <Text size="md">{value}</Text>
    </Group>
  );
}
