import { useState } from 'react';
import { Modal, Select, Button, Stack } from '@mantine/core';
import type { IAccountingObject } from '@/shared/types';

interface InvoiceMoveModalProps {
  opened: boolean;
  onClose: () => void;
  objects: IAccountingObject[];
  currentObjectId: string;
  onConfirm: (targetObjectId: string) => void;
  loading?: boolean;
}

export function InvoiceMoveModal({
  opened,
  onClose,
  objects,
  currentObjectId,
  onConfirm,
  loading,
}: InvoiceMoveModalProps) {
  const [targetId, setTargetId] = useState<string | null>(null);

  const options = objects
    .filter((o) => o.id !== currentObjectId)
    .map((o) => ({ value: o.id, label: o.name }));

  const handleConfirm = () => {
    if (targetId) {
      onConfirm(targetId);
      setTargetId(null);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setTargetId(null);
        onClose();
      }}
      title="Перенести в другой объект"
      size="sm"
    >
      <Stack onKeyDown={(e) => {
        if (e.key === 'Enter' && targetId) {
          e.preventDefault();
          handleConfirm();
        }
      }}>
        <Select
          label="Объект учёта"
          data={options}
          value={targetId}
          onChange={setTargetId}
          placeholder="Выберите объект"
        />
        <Button onClick={handleConfirm} disabled={!targetId} loading={loading}>
          Перенести
        </Button>
      </Stack>
    </Modal>
  );
}
