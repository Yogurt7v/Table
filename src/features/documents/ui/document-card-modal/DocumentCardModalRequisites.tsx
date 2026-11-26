import {
  Button,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconDeviceFloppy, IconPencil, IconX } from '@tabler/icons-react';
import { dateKeyToLocalDate, localDateToDateKey } from '@/features/mail/model/mail-date';
import type { IDocument } from '@/shared/types';
import type { DocumentForm } from './document-card-modal-types';

/** Пропсы блока реквизитов документа. */
export interface DocumentCardModalRequisitesProps {
  document: IDocument;
  form: DocumentForm;
  editing: boolean;
  canEdit: boolean;
  canEditPaymentDate: boolean;
  canEditResponsible: boolean;
  canMove: boolean;
  objectOptions: { value: string; label: string }[];
  userOptions: { value: string; label: string }[];
  saving: boolean;
  onPatch: (patch: Partial<DocumentForm>) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}

/**
 * Реквизиты документа: заголовок с кнопками «Редактировать»/«Сохранить»/«Отмена»
 * и сетка полей. В режиме просмотра поля только для чтения.
 */
export function DocumentCardModalRequisites({
  document,
  form,
  editing,
  canEdit,
  canEditPaymentDate,
  canEditResponsible,
  canMove,
  objectOptions,
  userOptions,
  saving,
  onPatch,
  onStartEdit,
  onCancelEdit,
  onSave,
}: DocumentCardModalRequisitesProps) {
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={editing ? { borderColor: 'var(--mantine-color-blue-4)' } : undefined}
    >
      {/* Заголовок: переключение между просмотром и редактированием */}
      <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
        <Text fw={600} size="sm" c="dimmed" tt="uppercase">
          Реквизиты
        </Text>
        {canEdit && !editing && (
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={onStartEdit}
          >
            Редактировать
          </Button>
        )}
        {editing && (
          <Group gap="xs">
            <Button
              size="xs"
              leftSection={<IconDeviceFloppy size={14} />}
              onClick={onSave}
              loading={saving}
            >
              Сохранить
            </Button>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconX size={14} />}
              onClick={onCancelEdit}
            >
              Отмена
            </Button>
          </Group>
        )}
      </Group>

      {/* Поля документа: правка ограничена правами текущей роли */}
      <Grid gutter="md">
        {/* Ряд 1: Контрагент (6) + Счёт № (3) + Договор (3) = 12 */}
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Контрагент"
            value={form.counterparty}
            onChange={(event) => onPatch({ counterparty: event.currentTarget.value })}
            readOnly={!editing || !canEdit}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 3 }}>
          <TextInput
            label="Счёт №"
            value={form.invoice_no}
            onChange={(event) => onPatch({ invoice_no: event.currentTarget.value })}
            readOnly={!editing || !canEdit}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 3 }}>
          <TextInput
            label="Договор"
            value={form.contract_no}
            onChange={(event) => onPatch({ contract_no: event.currentTarget.value })}
            readOnly={!editing || !canEdit}
          />
        </Grid.Col>

        {/* Ряд 2: Объект (6) + Дата оплаты (3) + Сумма (3) = 12 */}
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Select
            label="Объект"
            data={objectOptions}
            value={form.accounting_object_id}
            onChange={(value) => value && onPatch({ accounting_object_id: value })}
            disabled={!editing || !canMove}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 3 }}>
          <DatePickerInput
            label="Дата оплаты"
            valueFormat="DD.MM.YYYY"
            value={dateKeyToLocalDate(form.payment_date)}
            onChange={(value) => onPatch({ payment_date: localDateToDateKey(value) })}
            disabled={!editing || !canEditPaymentDate}
            clearable
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 3 }}>
          <NumberInput
            label="Сумма"
            value={form.amount}
            onChange={(value) => onPatch({ amount: typeof value === 'number' ? value : 0 })}
            readOnly={!editing || !canEdit}
            min={0}
            decimalScale={2}
            thousandSeparator=" "
          />
        </Grid.Col>

        {/* Ряд 3: Ответственный (6) + Автор (6) = 12 */}
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Select
            label="Ответственный"
            data={userOptions}
            value={form.responsible_id}
            onChange={(value) => value && onPatch({ responsible_id: value })}
            disabled={!editing || !canEditResponsible}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput label="Автор" value={document.created_by_name || '—'} readOnly />
        </Grid.Col>

        {/* Ряд 4: Назначение на всю ширину */}
        <Grid.Col span={12}>
          <Textarea
            label="Назначение"
            value={form.purpose}
            onChange={(event) => onPatch({ purpose: event.currentTarget.value })}
            readOnly={!editing || !canEdit}
            autosize
            minRows={2}
            maxRows={5}
          />
        </Grid.Col>
      </Grid>
    </Paper>
  );
}
