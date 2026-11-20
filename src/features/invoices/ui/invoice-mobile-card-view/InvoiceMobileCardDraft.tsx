import type { Ref } from 'react';
import type { KeyboardEvent } from 'react';
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  FileButton,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconPaperclip } from '@tabler/icons-react';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import type {
  DraftFieldErrors,
  DraftInvoiceForm,
} from '@/features/invoices/model/invoice-field-access';

interface InvoiceMobileCardDraftProps {
  draftForm: DraftInvoiceForm;
  draftErrors: DraftFieldErrors;
  draftCardRef: Ref<HTMLDivElement>;
  counterpartyResults?: string[];
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onFieldChange: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onFieldKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onRequestCancel: () => void;
  discardConfirmOpen: boolean;
  onDiscardClose: () => void;
  onDiscardConfirm: () => void;
}

/**
 * Карточка черновика нового счёта в мобильном виде: поля ввода, вложение,
 * сохранение/отмена и диалог подтверждения сброса несохранённых данных.
 */
export function InvoiceMobileCardDraft({
  draftForm,
  draftErrors,
  draftCardRef,
  counterpartyResults,
  onDraftChange,
  onFieldChange,
  onFieldKeyDown,
  onSave,
  onRequestCancel,
  discardConfirmOpen,
  onDiscardClose,
  onDiscardConfirm,
}: InvoiceMobileCardDraftProps) {
  // Форма черновика: подсвеченная карточка + диалог отмены с потерей данных.
  return (
    <>
      <Paper
        ref={draftCardRef}
        withBorder
        p="sm"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)',
          borderColor: 'var(--org-color, #228be6)',
          boxShadow:
            'inset 0 0 0 1px color-mix(in srgb, var(--org-color, #228be6) 40%, transparent)',
          animation: 'draft-pulse 1.4s ease-out 1',
        }}
      >
        <Badge
          size="sm"
          variant="light"
          mb="xs"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)',
            color: 'var(--org-color, #228be6)',
          }}
        >
          Новый счёт
        </Badge>
        <Stack gap="xs">
          <Autocomplete
            size="sm"
            value={draftForm.counterparty ?? ''}
            onChange={(v) => onFieldChange('counterparty', v)}
            onKeyDown={onFieldKeyDown}
            data={counterpartyResults || []}
            placeholder="Контрагент"
            error={draftErrors.counterparty}
          />
          <TextInput
            size="sm"
            value={draftForm.purpose ?? ''}
            onChange={(e) => onFieldChange('purpose', e.currentTarget.value)}
            onKeyDown={onFieldKeyDown}
            placeholder="Назначение"
            error={draftErrors.purpose}
          />
          <TextInput
            size="sm"
            value={draftForm.contract_no ?? ''}
            onChange={(e) => onFieldChange('contract_no', e.currentTarget.value)}
            onKeyDown={onFieldKeyDown}
            placeholder="Договор"
          />
          <TextInput
            size="sm"
            value={draftForm.invoice_no ?? ''}
            onChange={(e) => onFieldChange('invoice_no', e.currentTarget.value)}
            onKeyDown={onFieldKeyDown}
            placeholder="Счёт"
            error={draftErrors.invoice_no}
          />
          <NumberInput
            size="sm"
            value={draftForm.amount ?? 0}
            onChange={(v) => onFieldChange('amount', v ?? 0)}
            onKeyDown={onFieldKeyDown}
            thousandSeparator=" "
            decimalSeparator=","
            placeholder="Сумма"
            error={draftErrors.amount}
          />
          <TextInput
            size="sm"
            value={draftForm.comment ?? ''}
            onChange={(e) => onFieldChange('comment', e.currentTarget.value)}
            onKeyDown={onFieldKeyDown}
            placeholder="Комментарий"
          />
          <Group gap={4}>
            {/* Вложение черновика: выбор файла отдельно от валидируемых полей */}
            <FileButton onChange={(v) => onDraftChange?.('file', v)}>
              {(props) => (
                <Tooltip label={draftForm.file?.name ?? 'Прикрепить файл'}>
                  <ActionIcon
                    {...props}
                    variant={draftForm.file ? 'light' : 'subtle'}
                    color={draftForm.file ? 'blue' : 'gray'}
                    size="sm"
                  >
                    <IconPaperclip size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </FileButton>
            {draftForm.file && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {draftForm.file.name}
              </Text>
            )}
          </Group>
          <Group justify="flex-end" gap={4} mt="xs">
            <Button size="compact-sm" variant="default" onClick={onRequestCancel}>
              Отмена
            </Button>
            <Button size="compact-sm" color="green" onClick={onSave}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Paper>

      <ConfirmModal
        opened={discardConfirmOpen}
        onClose={onDiscardClose}
        onConfirm={onDiscardConfirm}
        title="Несохранённый счёт"
        message="Отменить добавление счёта? Введённые данные будут потеряны."
        confirmLabel="Отменить без сохранения"
      />
    </>
  );
}
