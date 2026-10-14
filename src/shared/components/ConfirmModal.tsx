import { Modal, Group, Button, Box } from '@mantine/core';
import type { MantineSize } from '@mantine/core';
import type { ReactNode } from 'react';

interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  color?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;

  /**
   * Ширина модалки. Умолчание `sm` — как у всех существующих вызовов; модалки
   * с формой внутри берут `md`, иначе поля и подпись ужимаются в 380px.
   */
  size?: MantineSize | (string & {}) | number;
  /**
   * Блок «что именно удаляется»: контрагент, номер, сумма. Обычные вызовы его
   * не передают, и в разметке он не появляется.
   */
  subject?: ReactNode;
  /**
   * Блок «что произойдёт»: запись уйдёт в архив и её можно вернуть. Стоит выше
   * поля ввода — последствия читают до того, как берутся за причину.
   */
  note?: ReactNode;
  /** Иконка на кнопке подтверждения — несёт смысл действия, а не украшает. */
  confirmLeftSection?: ReactNode;
  /**
   * Читаемое состояние «действие заблокировано». Mantine красит заблокированную
   * кнопку напрямую из серой ступени палитры (gray-5 на gray-1, ~1.9:1) мимо
   * `--button-color`, и ни `variant`, ни `styles` это не перебивают: правило
   * вне зависимости от варианта. А в модалке с обязательным полем кнопка
   * заблокирована дольше, чем доступна, поэтому подпись поднимается до gray-7
   * (~10:1) из той же палитры. Пока идёт `loading`, правило Mantine не
   * действует, и подпись остаётся белой на заливке.
   */
  confirmBlocked?: boolean;
}

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  color = 'red',
  loading = false,
  confirmDisabled = false,
  children,
  size = 'sm',
  subject,
  note,
  confirmLeftSection,
  confirmBlocked = false,
}: ConfirmModalProps) {
  const blockedLabel =
    confirmBlocked && confirmDisabled && !loading
      ? { color: 'var(--mantine-color-gray-7)' }
      : undefined;

  return (
    <Modal opened={opened} onClose={onClose} title={title} size={size}>
      {subject != null && <Box mb="lg">{subject}</Box>}
      {message != null && <Box mb="lg">{message}</Box>}
      {note != null && <Box mb="lg">{note}</Box>}
      {children != null && <Box mb="lg">{children}</Box>}
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          color={color}
          leftSection={confirmLeftSection}
          onClick={onConfirm}
          loading={loading}
          disabled={confirmDisabled}
          style={blockedLabel}
        >
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
