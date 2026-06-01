import { Modal, Stack, TextInput, Select, Button } from '@mantine/core';
import type { IBankAccount, IAccountingObject } from '@/shared/types';
import { BankAccountManager } from './BankAccountManager';
import { AccountingObjectManager } from './AccountingObjectManager';

const COLORS = [
  { value: '#228be6', label: 'Синий' },
  { value: '#40c057', label: 'Зелёный' },
  { value: '#fa5252', label: 'Красный' },
  { value: '#fab005', label: 'Жёлтый' },
  { value: '#7950f2', label: 'Фиолетовый' },
  { value: '#fd7e14', label: 'Оранжевый' },
  { value: '#15aabf', label: 'Голубой' },
  { value: '#e64980', label: 'Розовый' },
];

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
            data={COLORS}
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
