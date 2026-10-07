import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Popover,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconCheck, IconFilter, IconLink, IconPaperclip, IconX } from '@tabler/icons-react';
import type { DeliveryMethod } from '@/shared/types';
import { MAIL_DELIVERY_METHOD_NAMES } from '@/shared/types';
import {
  MAIL_ATTACHMENT_FILTER_LABELS,
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_FILTER_GROUP_LABELS,
  MAIL_NO_ACCOUNTING_OBJECT_LABEL,
  MAIL_NO_DELIVERY_METHOD_LABEL,
  // MAIL_PERIOD_PRESET_LABELS,
} from './mail-labels';
import { dateKeyToLocalDate, localDateToDateKey } from './mail-date';
import type { MailAttachmentFilter, MailFilterChip, UseMailFiltersResult } from './useMailFilters';

const DELIVERY_METHODS: DeliveryMethod[] = ['email', 'post', 'courier', 'messenger'];
// const PERIOD_ITEMS = ['today', 'week', 'month', 'all'] as const;

const CHECK_MARK = <IconCheck size={16} color="var(--mantine-color-blue-filled)" />;
const CHECK_PLACEHOLDER = <Box w={16} />;

/** Широко, но никогда не шире окна: горизонтальной прокрутки страницы быть не должно. */
const PANEL_WIDTH = 'min(1100px, 92vw)';

/**
 * Класс на выпадающем окне пикера периода. `DatePickerInput` рендерит его
 * через `Popover.Portal` прямо в `document.body`, то есть вне панели, поэтому
 * клик в нём для любого оверлея — клик снаружи. Пометив окно, панель может
 * отличить «пользователь выбирает дату» от «пользователь ушёл на страницу» и
 * не захлопнуться на середине выбора диапазона.
 */
const PERIOD_DROPDOWN_CLASS = 'mail-filters-period-dropdown';

const OPTION_SELECTOR = '[data-mail-filter-option]:not(:disabled)';
const COLUMN_SELECTOR = '[data-mail-filter-column]';

interface MailFiltersProps {
  filters: UseMailFiltersResult;
  mailType: 'incoming' | 'outgoing';
  accountingObjects: { id: string; name: string }[];
  responsibleOptions: { id: string; name: string }[];
  chips: MailFilterChip[];
}

/** Маркер выбранного пункта — тот же `IconCheck`/`Box w={16}`, что в реестре счетов. */
function checkMark(isActive: boolean): ReactNode {
  return isActive ? CHECK_MARK : CHECK_PLACEHOLDER;
}

interface FilterOptionProps {
  active: boolean;
  children: ReactNode;
  /** Красный сброс последним пунктом — как в меню. */
  danger?: boolean;
  disabled?: boolean;
  marker: ReactNode;
  onSelect: () => void;
  /** Сброс закрывает панель: у `Menu.Item` это было `closeMenuOnClick`. */
  closeOnSelect?: boolean;
  onClose: () => void;
}

/**
 * Пункт панели. Раньше это был `Menu.Item`; здесь та же строка вручную, потому
 * что `Menu` — это вертикальный список, а панель — сетка колонок. Внешний вид
 * (`mail-filters-option` в `src/index.css`) повторяет `Menu.Item` до пикселя,
 * включая серый hover, синий выбранный и приглушённый disabled.
 *
 * `aria-pressed`, а не `role="menuitem"`: в `Menu` роль была вынужденной, а
 * здесь это набор переключателей, и «нажато/не нажато» — точное объявление.
 */
function FilterOption({
  active,
  children,
  danger = false,
  disabled = false,
  marker,
  onSelect,
  closeOnSelect = false,
  onClose,
}: FilterOptionProps) {
  const vars = danger
    ? {
        '--mail-filter-option-color': 'var(--mantine-color-red-6)',
        '--mail-filter-option-hover': 'var(--mantine-color-red-light-hover)',
      }
    : active
      ? {
          '--mail-filter-option-color': 'var(--mantine-color-blue-6)',
          '--mail-filter-option-hover': 'var(--mantine-color-blue-light-hover)',
        }
      : undefined;

  return (
    <UnstyledButton
      className="mail-filters-option"
      data-mail-filter-option
      __vars={vars}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => {
        onSelect();
        if (closeOnSelect) onClose();
      }}
    >
      <span className="mail-filters-option__marker">{marker}</span>
      <span className="mail-filters-option__label">{children}</span>
    </UnstyledButton>
  );
}

function FilterColumn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box className="mail-filters-column" data-mail-filter-column>
      <Text className="mail-filters-column__label">{label}</Text>
      {children}
    </Box>
  );
}

/**
 * Панель фильтров реестра писем.
 *
 * Точка входа, подпись `Фильтр (N)`, синяя подсветка при активных группах и
 * маркер `IconCheck` на выбранном пункте — как у меню «Фильтр» в реестре счетов
 * (`InvoiceSection`). Само меню заменено на `Popover` с сеткой колонок: семь
 * групп, отметок и одно поле входа, столбиком — это до 800px высоты и уход за
 * нижний край экрана, а у групп «Объект учёта» и «Ответственный» длина ещё и
 * растёт с данными. Счётчик в подписи по-прежнему считает активные ГРУППЫ.
 *
 * Открытое состояние держит компонент, а не `Popover`: у `Menu` за это отвечал
 * `closeOnItemClick={false}`, у `Popover` такого пропса нет, и без явного
 * состояния панель закрывалась бы на каждом клике — то есть множественный
 * выбор стал бы невозможен.
 *
 * Ловушка портала. Пикеры периода живут в строке рядом с кнопкой, а не внутри
 * панели: `DatePickerInput` рендерит своё окно через `Popover.Portal` в
 * `document.body`, то есть вне ссылок панели, и клик в нём срабатывает как
 * клик снаружи. Штатный `closeOnClickOutside` из-за этого закрыл бы панель, не
 * успев выбрать дату, поэтому он выключен, а закрытие по клику вне ведёт
 * обработчик `useEffect` ниже: он исключает и панель, и кнопку, и помеченное
 * окно пикера. Все четыре предустановки периода остаются пунктами панели.
 */
export function MailFilters({
  filters,
  mailType,
  accountingObjects,
  responsibleOptions,
  chips,
}: MailFiltersProps) {
  const state = filters.filters;
  const periodActive = Boolean(state.customFrom || state.customTo);
  const [opened, setOpened] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!opened) return;
    const closeOnOutside = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('[data-mail-filter-trigger]')) return;
      if (target.closest('[data-mail-filter-period]')) return;
      if (target.closest(`.${PERIOD_DROPDOWN_CLASS}`)) return;
      setOpened(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
    };
  }, [opened]);

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
    const target = event.target;
    const column = target instanceof Element ? target.closest<HTMLElement>(COLUMN_SELECTOR) : null;
    const options = column ? Array.from(column.querySelectorAll<HTMLElement>(OPTION_SELECTOR)) : [];
    if (options.length === 0) return;
    event.preventDefault();
    const current = target instanceof HTMLElement ? options.indexOf(target) : -1;
    const next =
      key === 'Home'
        ? 0
        : key === 'End'
          ? options.length - 1
          : key === 'ArrowDown'
            ? Math.min(current + 1, options.length - 1)
            : Math.max(current - 1, 0);
    options[next]?.focus();
  };

  const close = () => setOpened(false);

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap" justify="space-between">
        <Popover
          opened={opened}
          onChange={setOpened}
          position="bottom-start"
          width={PANEL_WIDTH}
          shadow="md"
          trapFocus
          returnFocus
          closeOnClickOutside={false}
        >
          <Popover.Target data-mail-filter-trigger>
            <Button
              size="compact-sm"
              variant="light"
              style={{ padding: '0 20px' }}
              color={filters.activeCount > 0 ? 'blue' : 'gray'}
              leftSection={<IconFilter size={16} />}
              onClick={() => setOpened((value) => !value)}
            >
              {filters.activeCount > 0 ? `Фильтр (${filters.activeCount})` : 'Фильтр'}
            </Button>
          </Popover.Target>
          <Popover.Dropdown
            ref={panelRef}
            onKeyDown={handlePanelKeyDown}
            styles={{
              dropdown: {
                padding: 'var(--mantine-spacing-sm)',
                maxHeight: 'min(70dvh, 560px)',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
              },
            }}
          >
            <Box className="mail-filters-grid">
              {/*<FilterColumn label={MAIL_FILTER_GROUP_LABELS.period}>
                <Box className="mail-filters-column__body">
                  {PERIOD_ITEMS.map((preset) => (
                    <FilterOption
                      key={preset}
                      active={state.period === preset}
                      marker={checkMark(state.period === preset)}
                      onSelect={() => filters.setPeriod(preset)}
                      onClose={close}
                    >
                      {MAIL_PERIOD_PRESET_LABELS[preset]}
                    </FilterOption>
                  ))}
                </Box>
              </FilterColumn>*/}

              <FilterColumn label={MAIL_FILTER_GROUP_LABELS.accountingObject}>
                <Box className="mail-filters-column__body">
                  {accountingObjects.length === 0 && (
                    <Text className="mail-filters-empty" size="sm">
                      Нет доступных объектов
                    </Text>
                  )}
                  {accountingObjects.map((obj) => (
                    <FilterOption
                      key={obj.id}
                      active={state.accountingObjectIds.includes(obj.id)}
                      marker={checkMark(state.accountingObjectIds.includes(obj.id))}
                      onSelect={() => filters.toggleAccountingObject(obj.id)}
                      onClose={close}
                    >
                      {obj.name}
                    </FilterOption>
                  ))}
                  <FilterOption
                    active={state.withoutAccountingObject}
                    marker={checkMark(state.withoutAccountingObject)}
                    onSelect={filters.toggleWithoutAccountingObject}
                    onClose={close}
                  >
                    {MAIL_NO_ACCOUNTING_OBJECT_LABEL}
                  </FilterOption>
                </Box>
              </FilterColumn>

              <FilterColumn label={MAIL_FILTER_GROUP_LABELS.deliveryMethod}>
                <Box className="mail-filters-column__body">
                  {DELIVERY_METHODS.map((method) => (
                    <FilterOption
                      key={method}
                      active={state.deliveryMethods.includes(method)}
                      marker={checkMark(state.deliveryMethods.includes(method))}
                      onSelect={() => filters.toggleDeliveryMethod(method)}
                      onClose={close}
                    >
                      {MAIL_DELIVERY_METHOD_NAMES[method]}
                    </FilterOption>
                  ))}
                  <FilterOption
                    active={state.withoutDeliveryMethod}
                    marker={checkMark(state.withoutDeliveryMethod)}
                    onSelect={filters.toggleWithoutDeliveryMethod}
                    onClose={close}
                  >
                    {MAIL_NO_DELIVERY_METHOD_LABEL}
                  </FilterOption>
                </Box>
              </FilterColumn>

              <FilterColumn label={MAIL_FILTER_GROUP_LABELS.responsible}>
                <Box className="mail-filters-column__body">
                  {responsibleOptions.length === 0 && (
                    <Text className="mail-filters-empty" size="sm">
                      Нет пользователей
                    </Text>
                  )}
                  {responsibleOptions.map((option) => (
                    <FilterOption
                      key={option.id}
                      active={state.responsibleIds.includes(option.id)}
                      marker={checkMark(state.responsibleIds.includes(option.id))}
                      onSelect={() => filters.toggleResponsible(option.id)}
                      onClose={close}
                    >
                      {option.name}
                    </FilterOption>
                  ))}
                </Box>
              </FilterColumn>


              <FilterColumn label={MAIL_FILTER_GROUP_LABELS.attachments}>
                <Box className="mail-filters-column__body">
                  <AttachmentFilterItem
                    value="with"
                    current={state.attachments}
                    onSelect={filters.setAttachments}
                    onClose={close}
                  />
                  <AttachmentFilterItem
                    value="without"
                    current={state.attachments}
                    onSelect={filters.setAttachments}
                    onClose={close}
                  />
                </Box>
              </FilterColumn>

              <FilterColumn label={MAIL_FILTER_GROUP_LABELS.counterparty}>
                <TextInput
                  size="xs"
                  placeholder={`${MAIL_COUNTERPARTY_FIELD_LABELS[mailType]}…`}
                  aria-label={MAIL_FILTER_GROUP_LABELS.counterparty}
                  value={state.counterparty}
                  onChange={(e) => filters.setCounterparty(e.currentTarget.value)}
                />
              </FilterColumn>

              <FilterColumn label={MAIL_FILTER_GROUP_LABELS.relations}>
                <Box className="mail-filters-column__body">
                  <FilterOption
                    active={state.hasRelations}
                    marker={state.hasRelations ? CHECK_MARK : <IconLink size={16} />}
                    onSelect={filters.toggleHasRelations}
                    onClose={close}
                  >
                    Есть связанные письма
                  </FilterOption>
                </Box>
              </FilterColumn>
            </Box>

            <Box className="mail-filters-footer">
              <FilterOption
                active={false}
                danger
                disabled={filters.activeCount === 0}
                marker={<IconX size={16} />}
                onSelect={filters.resetAll}
                closeOnSelect
                onClose={close}
              >
                Сбросить все фильтры
              </FilterOption>
            </Box>
          </Popover.Dropdown>
        </Popover>

        <Box
          style={{ minWidth: 0 }}
          data-mail-filter-period
          data-active={periodActive || undefined}
          className="mail-period-box"
        >
          <DatePickerInput
            type="range"
            size="sm"
            w={{ base: '100%', sm: 320 }}
            placeholder="Период"
            aria-label="Период"
            clearable
            closeOnChange
            allowSingleDateInRange
            valueFormat="DD.MM.YYYY"
            labelSeparator=" – "
            leftSection={<IconCalendar size={16} />}
            leftSectionPointerEvents="none"
            styles={{
              input: { fontWeight: periodActive ? 600 : 400 },
            }}
            value={[dateKeyToLocalDate(state.customFrom), dateKeyToLocalDate(state.customTo)]}
            popoverProps={{ classNames: { dropdown: PERIOD_DROPDOWN_CLASS } }}
            onChange={(value) =>
              filters.setCustomRange(
                localDateToDateKey(value[0] ?? null),
                localDateToDateKey(value[1] ?? null),
              )
            }
          />
        </Box>
      </Group>

      {chips.length > 0 && (
        <Group gap={6} wrap="wrap">
          {chips.map((chip) => (
            <Badge
              key={`${chip.group}:${chip.value}`}
              variant="light"
              color="blue"
              size="sm"
              styles={{ label: { display: 'flex', alignItems: 'center', gap: 4 } }}
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  color="blue"
                  aria-label={`Убрать фильтр ${chip.label}`}
                  onClick={() => filters.removeChip(chip)}
                >
                  <IconX size={10} />
                </ActionIcon>
              }
            >
              {chip.label}
            </Badge>
          ))}
        </Group>
      )}
    </Stack>
  );
}

interface AttachmentFilterItemProps {
  value: Exclude<MailAttachmentFilter, 'any'>;
  current: MailAttachmentFilter;
  onSelect: (value: MailAttachmentFilter) => void;
  onClose: () => void;
}

function AttachmentFilterItem({ value, current, onSelect, onClose }: AttachmentFilterItemProps) {
  const isActive = current === value;
  return (
    <FilterOption
      active={isActive}
      marker={isActive ? CHECK_MARK : <IconPaperclip size={16} />}
      onSelect={() => onSelect(isActive ? 'any' : value)}
      onClose={onClose}
    >
      {MAIL_ATTACHMENT_FILTER_LABELS[value]}
    </FilterOption>
  );
}

/** Кнопка «Сбросить фильтры» под пустой таблицей — вне панели, чтобы её было видно. */
export function MailFiltersReset({ onReset }: { onReset: () => void }) {
  return (
    <Button
      variant="light"
      color="gray"
      size="compact-sm"
      mt="sm"
      leftSection={<IconX size={14} />}
      onClick={onReset}
    >
      Сбросить фильтры
    </Button>
  );
}
