import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconCalendarDot } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Button, Group } from '@mantine/core';
import { useInvoiceNavigation } from '@/shared/context/InvoiceNavigationContext';
import { useSearch } from '@/shared/context/SearchContext';

interface MainDatePickerProps {
  variant: 'page' | 'header';
}

/**
 * Выбор рабочей даты: обновляет календарь, сбрасывает режим «поиск по всем датам»
 * и показывает кнопку быстрого возврата на сегодня.
 */
export function MainDatePicker({ variant }: MainDatePickerProps) {
  const { selectedDate: date, setSelectedDate: setDate } = useInvoiceNavigation();
  const { setSearchAll } = useSearch();
  const isHeader = variant === 'header';
  const isPage = variant === 'page';
  const isNonToday = !dayjs(date).isSame(dayjs(), 'day');

  const handleDateChange = (value: Date | null) => {
    if (!value) return;
    setDate(value);
    setSearchAll(false);
  };

  const handleSetToday = () => {
    setDate(dayjs().toDate());
    setSearchAll(false);
  };

  // Рендерит инпут выбора даты, метку сегодняшнего дня в календаре и кнопку «Сегодня».
  return (
    <Group gap="xs" wrap="nowrap" align="center">
      <DatePickerInput
        maxDate={new Date()}
        leftSection={<IconCalendar size={isHeader ? 16 : 18} stroke={1.8} />}
        value={date}
        onChange={handleDateChange}
        valueFormat="D MMMM YYYY, dddd"
        size="sm"
        radius="md"
        aria-label="Выбор даты"
        maw={isPage ? { base: '100%', sm: 420 } : 340}
        w={isPage ? { base: '100%', sm: 'auto' } : '100%'}
        data-non-today={isNonToday ? 'true' : undefined}
        classNames={{ input: 'main-date-picker__input' }}
        styles={{
          input: {
            fontWeight: 650,
            fontSize: isHeader
              ? 'var(--mantine-font-size-sm)'
              : 'clamp(var(--mantine-font-size-sm), 1.8vw, var(--mantine-font-size-md))',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            transition:
              'border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
            ...(isPage
              ? {
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03)',
                }
              : {}),
            ...(isNonToday
              ? {
                  borderColor: 'var(--mantine-color-orange-4)',
                  backgroundColor:
                    'color-mix(in srgb, var(--mantine-color-orange-0) 45%, var(--mantine-color-body))',
                  boxShadow:
                    '0 0 0 1px color-mix(in srgb, var(--mantine-color-orange-4) 45%, transparent), 0 4px 14px color-mix(in srgb, var(--mantine-color-orange-4) 12%, transparent)',
                }
              : {}),
          },
        }}
        popoverProps={{
          shadow: 'md',
          radius: 'md',
          offset: 6,
          transitionProps: { transition: 'pop', duration: 160 },
          styles: {
            dropdown: {
              border:
                '1px solid color-mix(in srgb, var(--org-color, var(--mantine-color-blue-6)) 28%, var(--mantine-color-default-border))',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
            },
          },
        }}
        getDayProps={(renderDate) => {
          const isToday = dayjs(renderDate).isSame(dayjs(), 'day');
          return {
            style: isToday
              ? {
                  fontWeight: 700,
                  boxShadow: 'inset 0 0 0 1.5px var(--mantine-primary-color-filled)',
                  borderRadius: 'var(--mantine-radius-sm)',
                }
              : undefined,
          };
        }}
      />
      {isNonToday && (
        <Button
          variant="light"
          color="orange"
          size={isHeader ? 'xs' : 'sm'}
          radius="md"
          leftSection={<IconCalendarDot size={isHeader ? 14 : 16} stroke={1.8} />}
          onClick={handleSetToday}
          style={{ flexShrink: 0, transition: 'transform 120ms ease, opacity 120ms ease' }}
        >
          Сегодня
        </Button>
      )}
    </Group>
  );
}
