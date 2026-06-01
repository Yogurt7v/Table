import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Select,
  Group,
  ActionIcon,
  Button,
  Text,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

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

interface CreateOrgModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: (data: { name: string; color: string; accountNames: string[] }) => Promise<void>;
}

export function CreateOrgModal({ opened, onClose, onSave }: CreateOrgModalProps) {
  const [orgName, setOrgName] = useState('');
  const [orgColor, setOrgColor] = useState<string>(COLORS[0]!.value);
  const [accountNames, setAccountNames] = useState<string[]>([]);
  const [newAccountName, setNewAccountName] = useState('');

  const handleClose = () => {
    setOrgName('');
    setOrgColor(COLORS[0]!.value);
    setAccountNames([]);
    setNewAccountName('');
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Добавить организацию" size="md">
      <Stack onKeyDown={async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!orgName.trim()) return;
          await onSave({ name: orgName.trim(), color: orgColor, accountNames });
          handleClose();
        }
      }}>
        <TextInput
          label="Название"
          value={orgName}
          onChange={(e) => setOrgName(e.currentTarget.value)}
          required
        />
        <Select
          label="Цвет"
          data={COLORS}
          value={orgColor}
          onChange={(v) => v && setOrgColor(v)}
        />

        <Text size="sm" fw={500} mt="sm">
          Расчётные счета
        </Text>

        {accountNames.map((name, i) => (
          <Group key={i} gap={6} wrap="nowrap">
            <Text size="sm" style={{ flex: 1 }}>
              {name}
            </Text>
            <ActionIcon
              size="sm"
              color="red"
              variant="subtle"
              onClick={() => setAccountNames(accountNames.filter((_, j) => j !== i))}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        ))}

        <Group gap={6} wrap="nowrap">
          <TextInput
            size="xs"
            placeholder="Название счёта"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            size="compact-xs"
            onClick={() => {
              if (newAccountName.trim()) {
                setAccountNames([...accountNames, newAccountName.trim()]);
                setNewAccountName('');
              }
            }}
            disabled={!newAccountName.trim()}
          >
            Добавить
          </Button>
        </Group>

        <Button
          fullWidth
          mt="sm"
          onClick={async () => {
            await onSave({ name: orgName.trim(), color: orgColor, accountNames });
            handleClose();
          }}
          disabled={!orgName.trim()}
        >
          Создать
        </Button>
      </Stack>
    </Modal>
  );
}
