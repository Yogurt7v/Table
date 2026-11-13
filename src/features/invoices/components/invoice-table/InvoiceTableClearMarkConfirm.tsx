import { ConfirmModal } from '@/shared/components/ConfirmModal';

interface InvoiceTableClearMarkConfirmProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function InvoiceTableClearMarkConfirm({
  opened,
  onClose,
  onConfirm,
}: InvoiceTableClearMarkConfirmProps) {
  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Снятие отметки"
      message="Убрать отметку с этого счёта?"
    />
  );
}
