import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  Button,
  Box,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { MAIL_DELIVERY_METHOD_NAMES, type DeliveryMethod, type IIncomingMail, type IOutgoingMail, type MailType } from '@/shared/types';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { useBeforeUnloadGuard } from '@/shared/hooks/useBeforeUnloadGuard';
import { dateKeyToLocalDate, localDateToDateKey } from './mail-date';
import { toMailForm, validateMailForm } from './mail-form';
import type { MailFormErrors, MailFormState } from './mail-form';
import {
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_COUNTERPARTY_NUMBER_FIELD_LABELS,
  MAIL_NUMBER_FIELD_LABELS,
  MAIL_TYPE_LABELS,
} from './mail-labels';
import { mailEdgeEnd, mailNodeKey } from './mail-thread';
import type { MailLetterIndex, MailNodeKey, MailThreadGraph } from './mail-thread';
import {
  candidateByKey,
  intendedParentKey,
  PENDING_PARENT_INTENT,
  parentEdgesOf,
  suggestParent,
} from './mail-parent';
import type {
  MailCandidate,
  MailCandidateLookup,
  ParentIntent,
  ParentEdgeIndex,
} from './mail-parent';
import { MailChainView } from './MailChainView';
import { MailLinkControl } from './MailLinkControl';
import { MailParentPicker } from './MailParentPicker';
import { MailParentStrip } from './MailParentStrip';

/**
 * Одна форма на оба регистра. Набор полей у входящего и исходящего письма
 * отличается двумя строками — номером и контрагентом, — поэтому это две
 * ветки над общим состоянием, а не две формы: правила проверки, защита от
 * ухода со страницы и компоновка тогда гарантированно совпадают.
 *
 * Связь — не следствие номера. Номер контрагента под полем только предлагает
 * родителя (`MailParentStrip`), а записывается тот, кого человек назвал сам:
 * либо подтвердив предложение, либо через кнопку «Связь». Правка номера не
 * трогает ни одного ребра — смена поля и смена связи независимы.
 */

/**
 * Задержка пересчёта полосы. Ровно как в `MailSearchInput`: тот же набор
 * текста должен ощущаться одинаково во всём реестре, иначе один и тот же жест
 * в строке поиска и в поле формы ведёт себя по-разному.
 */
const RESOLVE_DEBOUNCE_MS = 280;

/**
 * Потолок блока с цепочкой. Цепочка на сто уровней в форму пускать нельзя —
 * `mail-thread` ограничивает глубину обхода, но и шесть узлов уже выталкивают
 * «Сохранить» за пределы окна. Прокручивается сам блок, а не модалка: подпись
 * «Вся цепочка письма» и кнопки остаются на своих местах при любой длине ветки.
 */
const CHAIN_PREVIEW_MAX_HEIGHT = 260;

interface MailFormModalProps {
  opened: boolean;
  onClose: () => void;
  mailType: MailType;
  /** Редактируемое письмо; `null` — создание. */
  mail: IIncomingMail | IOutgoingMail | null;
  /** Регистры, которые пользователю разрешено создавать, — для переключателя. */
  allowedTypes: MailType[];
  accountingObjects: { value: string; label: string }[];
  responsibleOptions: { value: string; label: string }[];
  saving: boolean;
  /** Связи организации: кандидаты в родители и уже записанные связи. */
  candidates: MailCandidateLookup | undefined;
  parentEdges: ParentEdgeIndex | undefined;
  graph: MailThreadGraph | undefined;
  letters: MailLetterIndex | undefined;
  cyclicKeys: ReadonlySet<MailNodeKey> | undefined;
  /** Право назвать или снять родителя: при создании — «создавать», при правке — «редактировать». */
  canLink: boolean;
  onTypeChange: (mailType: MailType) => void;
  onSave: (mailType: MailType, form: MailFormState, parentKey: MailNodeKey | null) => void;
  onOpenThread: (mailType: MailType, mailId: string) => void;
}

const DELIVERY_OPTIONS = (Object.keys(MAIL_DELIVERY_METHOD_NAMES) as DeliveryMethod[]).map(
  (value) => ({ value, label: MAIL_DELIVERY_METHOD_NAMES[value] }),
);

/** Ключ уже сохранённого родителя — им форма открывается, а не угадывается заново. */
function savedParentKey(
  parentEdges: ParentEdgeIndex | undefined,
  mailType: MailType,
  mail: IIncomingMail | IOutgoingMail | null,
): MailNodeKey | null {
  if (!mail) return null;
  const first = parentEdgesOf(parentEdges, mailNodeKey(mailType, mail.id))[0];
  return first?.parent.key ?? null;
}

/**
 * Форма открывается с сохранённым родителем как `picked`, а не как отсутствие
 * решения: пока человек не трогал связь, предлагать ему то же самое заново незачем.
 */
function initialIntent(
  parentEdges: ParentEdgeIndex | undefined,
  mailType: MailType,
  mail: IIncomingMail | IOutgoingMail | null,
): ParentIntent {
  const saved = savedParentKey(parentEdges, mailType, mail);
  return saved ? { kind: 'picked', key: saved } : PENDING_PARENT_INTENT;
}

export function MailFormModal({
  opened,
  onClose,
  mailType,
  mail,
  allowedTypes,
  accountingObjects,
  responsibleOptions,
  saving,
  candidates,
  parentEdges,
  graph,
  letters,
  cyclicKeys,
  canLink,
  onTypeChange,
  onSave,
  onOpenThread,
}: MailFormModalProps) {
  const [form, setForm] = useState<MailFormState>(() => toMailForm(mailType, mail));
  const [initialForm, setInitialForm] = useState<MailFormState>(() => toMailForm(mailType, mail));
  const [errors, setErrors] = useState<MailFormErrors>({});
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [intent, setIntent] = useState<ParentIntent>(() =>
    initialIntent(parentEdges, mailType, mail),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [debouncedNumber, setDebouncedNumber] = useState(form.counterpartyNumber);
  const isEditMode = mail !== null;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!opened) return;
    const next = toMailForm(mailType, mail);
    setForm(next);
    setInitialForm(next);
    setErrors({});
    setIntent(initialIntent(parentEdges, mailType, mail));
    setDebouncedNumber(next.counterpartyNumber);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [opened, mailType, mail, parentEdges]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedNumber(form.counterpartyNumber),
      RESOLVE_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [form.counterpartyNumber]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  useBeforeUnloadGuard(opened && isDirty);

  const patch = (next: Partial<MailFormState>) => {
    setForm((prev) => ({ ...prev, ...next }));
    setErrors((prev) => {
      const cleared = { ...prev };
      for (const key of Object.keys(next) as (keyof MailFormState)[]) {
        delete cleared[key as keyof MailFormErrors];
      }
      return cleared;
    });
  };

  const selfKey = isEditMode ? mailNodeKey(mailType, mail.id) : null;
  const savedKey = useMemo(
    () => savedParentKey(parentEdges, mailType, mail),
    [parentEdges, mailType, mail],
  );
  const suggestion = useMemo(
    () => suggestParent(candidates, mailType, debouncedNumber, selfKey),
    [candidates, mailType, debouncedNumber, selfKey],
  );
  const namedParent = candidateByKey(candidates, intendedParentKey(intent, savedKey));

  /** Предпросмотр строится вокруг сохранённого письма; у создаваемого цепочки ещё нет. */
  const chainRoot = useMemo(
    () => (isEditMode ? mailEdgeEnd(mailType, mail.id) : null),
    [isEditMode, mailType, mail],
  );

  const submit = () => {
    const fieldErrors = validateMailForm(form, mailType);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSave(mailType, form, namedParent?.key ?? null);
  };

  const close = () => {
    setErrors({});
    onClose();
  };

  const requestClose = () => {
    if (isDirty) {
      setConfirmCloseOpen(true);
      return;
    }
    close();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    e.preventDefault();
    submit();
  };

  const childLabel = form.number.trim() || form.counterparty.trim() || MAIL_TYPE_LABELS[mailType];

  return (
    <Modal
      opened={opened}
      onClose={requestClose}
      title={isEditMode ? 'Редактирование письма' : 'Новое письмо'}
      size="lg"
    >
      <Stack gap="md" onKeyDown={handleKeyDown}>
        {!isEditMode && allowedTypes.length > 1 && (
          <SegmentedControl
            fullWidth
            value={mailType}
            onChange={(value) => onTypeChange(value as MailType)}
            data={allowedTypes.map((type) => ({ value: type, label: MAIL_TYPE_LABELS[type] }))}
          />
        )}

        <Group grow align="flex-start">
          <DatePickerInput
            label="Дата письма"
            placeholder="Выберите дату"
            valueFormat="DD.MM.YYYY"
            required
            value={dateKeyToLocalDate(form.date)}
            onChange={(value) => patch({ date: localDateToDateKey(value) })}
            error={errors.date}
          />
          <TextInput
            label={MAIL_NUMBER_FIELD_LABELS[mailType]}
            placeholder="Например, 12/25"
            required={mailType === 'outgoing'}
            value={form.number}
            onChange={(e) => patch({ number: e.currentTarget.value })}
            error={errors.number}
          />
        </Group>

        <Group grow align="flex-start">
          <TextInput
            label={MAIL_COUNTERPARTY_FIELD_LABELS[mailType]}
            placeholder={MAIL_COUNTERPARTY_FIELD_LABELS[mailType]}
            required
            value={form.counterparty}
            onChange={(e) => patch({ counterparty: e.currentTarget.value })}
            error={errors.counterparty}
          />
          <TextInput
            label={MAIL_COUNTERPARTY_NUMBER_FIELD_LABELS[mailType]}
            placeholder="Номер письма контрагента"
            value={form.counterpartyNumber}
            onChange={(e) => patch({ counterpartyNumber: e.currentTarget.value })}
          />
        </Group>

        <Group gap="xs" align="flex-start" wrap="nowrap">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <MailParentStrip
              mailType={mailType}
              counterpartyNumber={debouncedNumber}
              suggestion={suggestion}
              intent={intent}
              parent={namedParent}
              canLink={canLink}
              onConfirm={(candidate: MailCandidate) =>
                setIntent({ kind: 'picked', key: candidate.key })
              }
              onPickManually={() => setPickerOpen(true)}
              onDecline={() => setIntent({ kind: 'declined' })}
              onOpenThread={onOpenThread}
            />
          </Box>
          <MailLinkControl
            parent={namedParent}
            canLink={canLink}
            onPick={() => setPickerOpen(true)}
            onRemove={() => setIntent({ kind: 'declined' })}
          />
        </Group>

        {chainRoot && graph && (
          <Paper withBorder p="xs" radius="sm">
            <Text size="xs" c="dimmed" mb={6}>
              Вся цепочка письма
            </Text>
            <Box mah={CHAIN_PREVIEW_MAX_HEIGHT} style={{ overflowY: 'auto' }}>
              <MailChainView
                graph={graph}
                letters={letters}
                root={chainRoot}
                cyclicKeys={cyclicKeys}
              />
            </Box>
          </Paper>
        )}

        <TextInput
          label="Тема"
          placeholder="Кратко о письме"
          required
          value={form.subject}
          onChange={(e) => patch({ subject: e.currentTarget.value })}
          error={errors.subject}
        />

        <Group grow align="flex-start">
          <Select
            label="Ответственный"
            placeholder="Выберите сотрудника"
            searchable
            required
            data={responsibleOptions}
            value={form.responsible || null}
            onChange={(value) => patch({ responsible: value ?? '' })}
            error={errors.responsible}
          />
          <Select
            label="Объект учёта"
            placeholder="Без объекта учёта"
            clearable
            searchable
            data={accountingObjects}
            value={form.accountingObjectId || null}
            onChange={(value) => patch({ accountingObjectId: value ?? '' })}
          />
        </Group>

        <Select
          label="Способ доставки"
          placeholder="Не указан"
          clearable
          data={DELIVERY_OPTIONS}
          value={form.deliveryMethod}
          onChange={(value) => patch({ deliveryMethod: (value as DeliveryMethod | null) ?? null })}
        />

        <Textarea
          label="Комментарий"
          placeholder="Комментарий к письму"
          autosize
          minRows={2}
          maxLength={2000}
          value={form.comment}
          onChange={(e) => patch({ comment: e.currentTarget.value })}
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={requestClose}>
            Отмена
          </Button>
          <Button onClick={submit} loading={saving}>
            {isEditMode ? 'Сохранить' : 'Добавить'}
          </Button>
        </Group>
      </Stack>

      <MailParentPicker
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(candidate) => setIntent({ kind: 'picked', key: candidate.key })}
        candidates={candidates}
        selfKey={selfKey}
        childLabel={childLabel}
      />

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
