import { Button, Group, Modal, SegmentedControl, Stack } from '@mantine/core';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { MAIL_TYPE_LABELS } from '../../mail-labels';
import { MailFormModalFields } from '../mail-form-modal/MailFormModalFields';
import { FORM_CONTENT_MAX_WIDTH } from '../mail-form-modal/mail-form-modal-constants';
import { useMailFormModal } from '../mail-form-modal/useMailFormModal';
import type { MailFormModalProps } from '../mail-form-modal/mail-form-modal-types';

/**
 * Модалка создания/редактирования/копирования письма.
 * Собирает переключатель регистра, поля письма, футер и подтверждение закрытия;
 * состояние и обработчики живут в `useMailFormModal`.
 */
export function MailFormModal(props: MailFormModalProps) {
  const {
    opened,
    mailType,
    copying,
    allowedTypes,
    saving,
    counterpartyOptions,
    accountingObjects,
    responsibleOptions,
    candidates,
    canLink,
    onOpenThread,
  } = props;
  const {
    form,
    errors,
    intent,
    debouncedNumber,
    wide,
    isEditMode,
    suggestion,
    namedParent,
    parentOptions,
    confirmCloseOpen,
    setConfirmCloseOpen,
    patch,
    pickParent,
    declineParent,
    submit,
    close,
    requestClose,
    handleKeyDown,
    switchRegister,
  } = useMailFormModal(props);

  // Рендерит окно с переключателем регистра, полями письма, футером и подтверждением закрытия
  return (
    <Modal
      opened={opened}
      onClose={requestClose}
      title={copying ? 'Копия письма' : isEditMode ? 'Редактирование письма' : 'Новое письмо'}
      size="xl"
      fullScreen={!wide}
      onKeyDown={handleKeyDown}
      styles={{
        content: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      <Stack
        gap="lg"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 4,
          maxWidth: FORM_CONTENT_MAX_WIDTH,
          marginInline: 'auto',
          width: '100%',
        }}
      >
        {/* Переключатель регистра (виден при создании/копировании) */}
        {(!isEditMode || copying) && allowedTypes.length > 1 && (
          <SegmentedControl
            fullWidth
            value={mailType}
            onChange={(value) => switchRegister(value as typeof mailType)}
            data={allowedTypes.map((type) => ({ value: type, label: MAIL_TYPE_LABELS[type] }))}
            style={{ flexShrink: 0 }}
          />
        )}

        {/* Поля письма */}
        <MailFormModalFields
          mailType={mailType}
          form={form}
          errors={errors}
          counterpartyOptions={counterpartyOptions}
          debouncedNumber={debouncedNumber}
          suggestion={suggestion}
          intent={intent}
          namedParent={namedParent}
          canLink={canLink}
          parentOptions={parentOptions}
          candidates={candidates}
          responsibleOptions={responsibleOptions}
          accountingObjects={accountingObjects}
          onPatch={patch}
          onConfirmParent={pickParent}
          onDeclineParent={declineParent}
          onOpenThread={onOpenThread}
        />
      </Stack>

      {/* Футер: отмена и сохранение */}
      <Group
        justify="flex-end"
        gap="sm"
        mt="md"
        pt="sm"
        style={{ flexShrink: 0, borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Button variant="default" onClick={requestClose}>
          Отмена
        </Button>
        <Button onClick={submit} loading={saving}>
          {isEditMode && !copying ? 'Сохранить' : 'Добавить'}
        </Button>
      </Group>

      {/* Подтверждение закрытия с несохранёнными изменениями */}
      <ConfirmModal
        opened={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          close();
        }}
        title="Несохранённые изменения"
        message="Закрыть без сохранения? Введённые данные будут потеряны."
        confirmLabel="Закрыть без сохранения"
      />
    </Modal>
  );
}
