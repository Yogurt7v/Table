import { Box, Button, Group, Popover, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconFilter, IconX } from '@tabler/icons-react';
import { dateKeyToLocalDate, localDateToDateKey } from '../../mail-date';
import { MailFiltersChips } from '../mail-filters/MailFiltersChips';
import { MailFiltersPanel } from '../mail-filters/MailFiltersPanel';
import { MailFiltersSortToggle } from '../mail-filters/MailFiltersSortToggle';
import { PANEL_WIDTH, PERIOD_DROPDOWN_CLASS } from '../mail-filters/mail-filters-constants';
import type { MailFiltersProps } from '../mail-filters/mail-filters-types';
import { useMailFiltersPanel } from '../mail-filters/useMailFiltersPanel';

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
 * Открытое состояние, закрытие по клику вне и навигация стрелками живут в
 * `useMailFiltersPanel` (включая ловушку portal пикера периода и исключение
 * переключателя порядка); сетка колонок — в `MailFiltersPanel`.
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
  const { opened, setOpened, panelRef, handlePanelKeyDown, close } = useMailFiltersPanel();

  // Шапка: слева — порядок и кнопка «Фильтр», справа — пикер периода;
  // под строкой — плашки активных отборов.
  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap" justify="space-between">
        <Group gap="xs">
          <MailFiltersSortToggle filters={filters} />

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
              <MailFiltersPanel
                filters={filters}
                mailType={mailType}
                accountingObjects={accountingObjects}
                responsibleOptions={responsibleOptions}
                onClose={close}
              />
            </Popover.Dropdown>
          </Popover>
        </Group>

        {/* Пикер периода вне панели: его окно живёт в document.body (см. useMailFiltersPanel). */}
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

      <MailFiltersChips chips={chips} onRemove={filters.removeChip} />
    </Stack>
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
