import { Modal, Stack, TextInput, Select, Button } from '@mantine/core';
import type { IBankAccount, IAccountingObject } from '@/shared/types';
import { ORG_COLORS } from '@/shared/utils/org-colors';
import { BankAccountManager } from './BankAccountManager';
import { AccountingObjectManager } from './AccountingObjectManager';

interface EditOrgModalProps {
  opened: boolean;
  orgName: string | undefined;
  editName: string;
  editColor: string;
  editOrgId: string;
  editAccounts: IBankAccount[] | undefined;
  editObjects: IAccountingObject[];
  canEditAccountingObjects: boolean;
  isPending: boolean;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSave: () => void;
}

export function EditOrgModal({
  opened,
  orgName,
  editName,
  editColor,
  editOrgId,
  editAccounts,
  editObjects,
  canEditAccountingObjects,
  isPending,
  onClose,
  onNameChange,
  onColorChange,
  onSave,
}: EditOrgModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Редактирование: ${orgName ?? ''}`}
      size="md"
    >
      {editOrgId && editAccounts && (
        <Stack onKeyDown={(e) => {
          if (e.key === 'Enter' && editName.trim()) {
            e.preventDefault();
            onSave();
          }
        }}>
          <TextInput
            label="Название"
            value={editName}
            onChange={(e) => onNameChange(e.currentTarget.value)}
          />
          <Select
            label="Цвет"
            data={ORG_COLORS}
            value={editColor}
            onChange={(v) => v && onColorChange(v)}
          />
          <BankAccountManager organizationId={editOrgId} accounts={editAccounts} />
          <AccountingObjectManager
            organizationId={editOrgId}
            objects={editObjects}
            canEdit={canEditAccountingObjects}
          />
          <Button
            fullWidth
            onClick={onSave}
            loading={isPending}
            disabled={!editName.trim()}
          >
            Сохранить
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
