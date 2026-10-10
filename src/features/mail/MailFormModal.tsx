import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  Autocomplete,
  Button,
  Box,
  Grid,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  MultiSelect,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { IconHistory } from '@tabler/icons-react';
import {
  MAIL_DELIVERY_METHOD_NAMES,
  type DeliveryMethod,
  type IIncomingMail,
  type IOutgoingMail,
  type MailType,
} from '@/shared/types';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { useBeforeUnloadGuard } from '@/shared/hooks/useBeforeUnloadGuard';
import { dateKeyToLocalDate, localDateToDateKey } from './mail-date';
import { toMailForm, validateMailForm, carryOverForRegisterSwitch } from './mail-form';
import type { MailFormErrors, MailFormState } from './mail-form';
import {
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_COUNTERPARTY_NUMBER_FIELD_LABELS,
  MAIL_NUMBER_FIELD_LABELS,
  MAIL_TYPE_LABELS,
} from './mail-labels';
import { mailNodeKey } from './mail-thread';
import type { MailNodeKey } from './mail-thread';
import {
  candidateByKey,
  intendedParentKey,
  parentSelectOptions,
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
import { isOptionsGroup } from '@mantine/core';
import type { ComboboxItem, ComboboxLikeProps } from '@mantine/core';
import { rankCounterpartyMatches } from './mail-counterparty-match';
import { MailParentHint } from './MailParentHint';

/**
 * Одна форма на оба регистра. Набор полей у входящего и исходящего письма
 * отличается двумя строками — номером и контрагентом, — поэтому это две
 * ветки над общим состоянием, а не две формы: правила проверки, защита от
 * ухода со страницы и компоновка тогда гарантированно совпадают.
 *
 * Связь — не следствие номера. Номер контрагента под полем только предлагает
 * родителя (`MailParentHint`), а записывается тот, кого человек назвал сам: либо
 * подтвердив предложение, либо в поле «Ответ на». Правка номера не трогает ни
 * одного ребра — смена поля и смена связи независимы.
 *
 * **Связь — поле, а не отдельный блок.** Она стоит рядом с датой и номером,
 * потому что это и есть данные письма: на какое оно отвечает. Свой раздел с
 * рамкой, шерилд-подсказкой и тремя кнопками читался как второстепенный
 * блок, который к тому же прятал номер — ровно то, ради чего строка и нужна.
 * Догадка по номеру контрагента осталась под полем номера: она выросла оттуда и
 * задаёт вопрос именно этому полю.
 *
 * Цепочка письма в форму не встроена: она живёт в отдельном окне переписки, а
 * кнопка «Открыть переписку» его открывает. Постоянно видимый список писем
 * занимал бы место, которое нужно письму, и почти всегда был не нужен.
 */

/** Граница `sm` — тот же порог, по которому `MailThreadBuilder` меняет раскладку. */
const WIDE_QUERY = '(min-width: 48em)';

/**
 * Ширина колонки полей. Форма — это письмо, а не таблица: растянутая на
 * весь экран строка читается хуже, чем та же строка в 880 пикселей, поэтому
 * колонка ограничена и центрирована независимо от ширины окна.
 */
const FORM_CONTENT_MAX_WIDTH = 880;

/**
 * Задержка пересчёта подсказки по номеру. Ровно как в `MailSearchInput`: тот же
 * набор текста должен ощущаться одинаково во всём реестре, иначе один и тот же
 * жест в строке поиска и в поле формы ведёт себя по-разному.
 */
const RESOLVE_DEBOUNCE_MS = 280;

/**
 * Потолок выпадающих списков. Восемь строк `limit` однострочными подписями в
 * него укладываются, а длинные названия с переносом второй строки — уже нет,
 * и список обязан остаться прокручиваемым блоком, а не растягивать форму.
 */
const DROPDOWN_MAX_HEIGHT = 300;

type CounterpartyFilter = NonNullable<ComboboxLikeProps['filter']>;

/**
 * Переходник от `filter` Mantine к `rankCounterpartyMatches`, который про Mantine
 * ничего не знает.
 *
 * Свой `filter` вместо штатного `defaultOptionsFilter` обязателен по двум
 * причинам, проверенным по исходникам Mantine 7.17.8: тот сохраняет порядок
 * `options` и режет его по `limit` (а словарь отсортирован по алфавиту целиком,
 * поэтому совпадение из середины слова не доходило до выпадающего списка), и он
 * делает только `trim()`, тогда как ранжирование сравнивает через
 * `foldSearchText` — из-за неразрывных пробелов в названиях.
 *
 * Групп в `data` быть не может — он собран из строк, — но тип `filter` допускает
 * `ComboboxParsedItemGroup`, поэтому группы отсекаются штатным `isOptionsGroup`,
 * а не приведением типа. Возвращаем те же опции, что пришли: `label` у них равен
 * `value`, и пересобирать его здесь означало бы дублировать формат Mantine.
 */
const rankCounterpartyOptions: CounterpartyFilter = ({ options, search, limit }) => {
  const items = options.filter((option): option is ComboboxItem => !isOptionsGroup(option));
  const byValue = new Map(items.map((option) => [option.value, option]));
  return rankCounterpartyMatches([...byValue.keys()], search, limit)
    .map((value) => byValue.get(value))
    .filter((option): option is ComboboxItem => option !== undefined);
};

interface MailFormModalProps {
  opened: boolean;
  onClose: () => void;
  mailType: MailType;
  /** Редактируемое письмо; `null` — создание. */
  mail: IIncomingMail | IOutgoingMail | null;
  /**
   * Копия: форма наполняется чужим письмом, но сохраняется как новое — без номера
   * и без связей, чтобы не задвоить запись и не встроить копию в чужую переписку.
   */
  copying?: boolean;
  /** Регистры, которые пользователю разрешено создавать, — для переключателя. */
  allowedTypes: MailType[];
  accountingObjects: { value: string; label: string }[];
  responsibleOptions: { value: string; label: string }[];
  /** Контрагенты организации для подсказок — общий словарь обеих вкладок. */
  counterpartyOptions: string[];
  saving: boolean;
  /** Связи организации: кандидаты в родители и уже записанные связи. */
  candidates: MailCandidateLookup | undefined;
  parentEdges: ParentEdgeIndex | undefined;
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
  copying,
  allowedTypes,
  accountingObjects,
  responsibleOptions,
  counterpartyOptions,
  saving,
  candidates,
  parentEdges,
  canLink,
  onTypeChange,
  onSave,
  onOpenThread,
}: MailFormModalProps) {
  const [form, setForm] = useState<MailFormState>(() =>
    toMailForm(mailType, mail, { clearNumber: copying }),
  );
  const [initialForm, setInitialForm] = useState<MailFormState>(() =>
    toMailForm(mailType, mail, { clearNumber: copying }),
  );
  const [errors, setErrors] = useState<MailFormErrors>({});
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [intent, setIntent] = useState<ParentIntent>(() =>
    initialIntent(parentEdges, mailType, mail),
  );
  const [debouncedNumber, setDebouncedNumber] = useState(form.counterpartyNumber);
  const isEditMode = mail !== null;

  /**
   * Регистр переключён переключателем во время копирования. Отдельный флаг, а не
   * сравнение с источником: `mail` при смене регистра меняется сам — письмо
   * прежнего типа уже не лежит в коллекции нового — и по нему смена регистра
   * неотличима от открытия другой копии.
   */
  const registerSwitchedRef = useRef(false);

  const wide = useMediaQuery(WIDE_QUERY, true, { getInitialValueInEffect: true }) !== false;

  useEffect(() => {
    if (!opened) {
      registerSwitchedRef.current = false;
      return;
    }
    // Форма уже перенесена обработчиком переключателя, заново наполнять её
    // письмом прежнего регистра нельзя.
    if (registerSwitchedRef.current) {
      registerSwitchedRef.current = false;
      return;
    }
    const next = toMailForm(mailType, mail, { clearNumber: copying });
    setForm(next);
    setInitialForm(next);
    setErrors({});
    // Копия письма не должна наследовать его родителя, поэтому источник связей
    // для неё намеренно пуст, иначе форма сразу предложит чужую цепочку.
    setIntent(initialIntent(parentEdges, mailType, copying ? null : mail));
    setDebouncedNumber(next.counterpartyNumber);
  }, [opened, mailType, mail, copying, parentEdges]);

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

  /**
   * Опции поля «Ответ на» — те же письма, что показывает ручной подбор, только
   * свежие сверху и без самого письма среди них.
   */
  const parentOptions = useMemo(
    () => parentSelectOptions(candidates, selfKey),
    [candidates, selfKey],
  );

  const pickParent = (candidate: MailCandidate) => {
    setIntent({ kind: 'picked', key: candidate.key });
  };

  /**
   * Очистка поля — это тот же отказ от связи, а не отдельное состояние: и то и
   * другое оставляет письмо в начале цепочки, и `intendedParentKey` отдаёт по
   * нему `null`, который `MailSection` превращает в план снятия связи.
   */
  const declineParent = () => {
    setIntent({ kind: 'declined' });
  };

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

  /**
   * Смена регистра переключателем. При копии письмо ещё не сохранено, поэтому
   * введённое переносится в новый регистр целиком — кроме номера, который в
   * другом реестре означает другое поле. При правке переключателя нет вовсе:
   * `updateIncoming` и `updateOutgoing` пишут в разные коллекции, и смена
   * регистра у сохранённого письма порвала бы его связи и историю.
   */
  const switchRegister = (next: MailType) => {
    if (copying && next !== mailType) {
      const carried = carryOverForRegisterSwitch(form);
      setForm(carried);
      setInitialForm(carried);
      setErrors({});
      setDebouncedNumber(carried.counterpartyNumber);
      registerSwitchedRef.current = true;
    }
    onTypeChange(next);
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
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;
    // Enter в списке с подсвеченной опцией принадлежит списку, а не форме: и
    // `Autocomplete`, и `MultiSelect` вешают `aria-activedescendant` только при
    // реальной подсветке (после `ArrowDown`) — проверено на Mantine 7.17.8.
    if (target.dataset.expanded === 'true' && target.getAttribute('aria-activedescendant')) return;
    e.preventDefault();
    submit();
  };

  const letterFields = (
    <Stack gap="lg" style={{ flexShrink: 0 }}>
      <FormSection title="Кому и о чём">
        <Autocomplete
          label={MAIL_COUNTERPARTY_FIELD_LABELS[mailType]}
          placeholder={MAIL_COUNTERPARTY_FIELD_LABELS[mailType]}
          required
          value={form.counterparty}
          onChange={(value) => patch({ counterparty: value })}
          data={counterpartyOptions}
          filter={rankCounterpartyOptions}
          limit={8}
          maxDropdownHeight={DROPDOWN_MAX_HEIGHT}
          error={errors.counterparty}
        />
        <TextInput
          label="Тема"
          placeholder="Кратко о письме"
          required
          value={form.subject}
          onChange={(e) => patch({ subject: e.currentTarget.value })}
          error={errors.subject}
        />
      </FormSection>

      {/*<FormSection title="Когда и под каким номером">*/}
        <Group grow align="flex-start" wrap="nowrap">
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

        <TextInput
          label={MAIL_COUNTERPARTY_NUMBER_FIELD_LABELS[mailType]}
          placeholder="Номер письма контрагента"
          value={form.counterpartyNumber}
          onChange={(e) => patch({ counterpartyNumber: e.currentTarget.value })}
        />

        <MailParentHint
          mailType={mailType}
          counterpartyNumber={debouncedNumber}
          suggestion={suggestion}
          intent={intent}
          parent={namedParent}
          canLink={canLink}
          onConfirm={pickParent}
          onDecline={declineParent}
        />

        {canLink && (
          <Box>
            <Select
              label="Ответ на"
              placeholder="Письмо, на которое это ответ"
              searchable
              clearable
              limit={8}
              maxDropdownHeight={DROPDOWN_MAX_HEIGHT}
              data={parentOptions}
              value={namedParent?.key ?? null}
              onChange={(value) => {
                if (!value) {
                  declineParent();
                  return;
                }
                // Ключ приходит из наших же опций, поэтому и письмо ищется в
                // том же `all`: разбирать `MailNodeKey` обратно на регистр и id
                // ради одного клика не нужно, а приведения типов — тем более.
                const picked = candidates?.all.find((candidate) => candidate.key === value);
                if (picked) pickParent(picked);
              }}
            />
            {namedParent && (
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                mt={4}
                px={0}
                leftSection={<IconHistory size={14} />}
                onClick={() => onOpenThread(namedParent.type, namedParent.id)}
              >
                Открыть переписку
              </Button>
            )}
          </Box>
        )}
      {/*</FormSection>*/}

      <FormSection title="Дополнительно">
        {/* `Grid`, а не `Group`: `Group` не складывается, а три поля подряд на
            широком окне экономят строку, которой на узком экране всё равно нет. */}
        <Grid gutter="md" align="flex-start">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <MultiSelect
              label="Ответственный"
              placeholder="Выберите сотрудников"
              searchable
              required
              hidePickedOptions
              maxValues={6}
              data={responsibleOptions}
              value={parseResponsible(form.responsible)}
              onChange={(values) => patch({ responsible: values.join(',') })}
              error={errors.responsible}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Объект учёта"
              placeholder="Без объекта учёта"
              clearable
              searchable
              data={accountingObjects}
              value={form.accountingObjectId || null}
              onChange={(value) => patch({ accountingObjectId: value ?? '' })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Способ доставки"
              placeholder="Не указан"
              clearable
              data={DELIVERY_OPTIONS}
              value={form.deliveryMethod}
              onChange={(value) =>
                patch({ deliveryMethod: (value as DeliveryMethod | null) ?? null })
              }
            />
          </Grid.Col>
        </Grid>
        <Textarea
          label="Комментарий"
          placeholder="Комментарий к письму"
          autosize
          minRows={2}
          maxLength={2000}
          value={form.comment}
          onChange={(e) => patch({ comment: e.currentTarget.value })}
        />
      </FormSection>
    </Stack>
  );

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
        {(!isEditMode || copying) && allowedTypes.length > 1 && (
          <SegmentedControl
            fullWidth
            value={mailType}
            onChange={(value) => switchRegister(value as MailType)}
            data={allowedTypes.map((type) => ({ value: type, label: MAIL_TYPE_LABELS[type] }))}
            style={{ flexShrink: 0 }}
          />
        )}

        {letterFields}
      </Stack>

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

/**
 * Подзаголовок группы полей. Тихая подпись с линейкой, а не заголовок: группы
 * нужны, чтобы глаз не перечитывал все поля подряд, но спорить с названием
 * окна им не место.
 */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Group gap="xs" wrap="nowrap" align="center" mb="xs">
        <Text size="xs" fw={600} c="dimmed" style={{ flexShrink: 0 }}>
          {title}
        </Text>
        <Box style={{ flex: 1, height: 1, background: 'var(--mantine-color-default-border)' }} />
      </Group>
      <Stack gap="sm">{children}</Stack>
    </Box>
  );
}

/**
 * Список ответственных из строки формы. Разбор идёт с обрезкой краёв, потому что
 * строка приходит из базы, а писал её прежний разбор: у одного второго
 * ответственного без обрезки не нашлось бы подписи и он читался пустым.
 */
function parseResponsible(value: string): string[] {
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
