import { useState } from 'react';
import { Modal, Stack, Text, TextInput, Group, Button, List } from '@mantine/core';
import { pluralCount } from '@/shared/utils/plural-ru';

export interface OrgDeleteStats {
  invoicesCount: number | null;
  objectsCount: number;
  accountsCount: number;
  membersCount: number;
}

interface DeleteOrgModalProps {
  opened: boolean;
  orgName: string;
  stats?: OrgDeleteStats;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const INVOICE_FORMS: [string, string, string] = ['счёт', 'счёта', 'счетов'];
const OBJECT_FORMS: [string, string, string] = ['объект учёта', 'объекта учёта', 'объектов учёта'];
const ACCOUNT_FORMS: [string, string, string] = ['банковский счёт', 'банковских счёта', 'банковских счетов'];
const MEMBER_FORMS: [string, string, string] = ['участник', 'участника', 'участников'];

export function DeleteOrgModal({
  opened,
  orgName,
  stats,
  isPending,
  onClose,
  onConfirm,
}: DeleteOrgModalProps) {
  const [confirmText, setConfirmText] = useState('');

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    setConfirmText('');
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`Удаление организации «${orgName}»`}
      size="sm"
    >
      <Stack onKeyDown={(e) => {
        if (e.key === 'Enter' && confirmText === 'я осознаю последствия') {
          e.preventDefault();
          handleConfirm();
        }
      }}>
        <Text size="sm">
          Это действие необратимо. Будут удалены безвозвратно:
        </Text>
        <List size="sm" spacing={4}>
          <List.Item>
            {stats?.invoicesCount == null ? (
              <Text size="sm" c="dimmed">счета (подсчёт…)</Text>
            ) : (
              pluralCount(stats.invoicesCount, INVOICE_FORMS)
            )}
          </List.Item>
          <List.Item>{pluralCount(stats?.objectsCount ?? 0, OBJECT_FORMS)}</List.Item>
          <List.Item>{pluralCount(stats?.accountsCount ?? 0, ACCOUNT_FORMS)}</List.Item>
          <List.Item>
            {stats?.membersCount ? (
              <>
                {pluralCount(stats.membersCount, MEMBER_FORMS)} — они{' '}
                {stats.membersCount === 1 ? 'потеряет' : 'потеряют'} доступ к организации
              </>
            ) : (
              '0 участников'
            )}
          </List.Item>
        </List>
        <Text size="xs" c="dimmed">
          История изменений, отметки к оплате и балансы будут удалены вместе со счетами.
        </Text>
        <Text size="sm" fw={500}>
          Введите «я осознаю последствия» для подтверждения:
        </Text>
        <TextInput
          value={confirmText}
          onChange={(e) => setConfirmText(e.currentTarget.value)}
          placeholder="я осознаю последствия"
          aria-label="Подтверждающая фраза"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleClose} disabled={isPending}>
            Отмена
          </Button>
          <Button
            color="red"
            disabled={confirmText !== 'я осознаю последствия' || isPending}
            loading={isPending}
            onClick={handleConfirm}
          >
            Удалить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
