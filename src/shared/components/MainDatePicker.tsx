import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useInvoiceNavigation } from '@/shared/context/InvoiceNavigationContext';

interface MainDatePickerProps {
  variant: 'page' | 'header';
}

export function MainDatePicker({ variant }: MainDatePickerProps) {
  const { selectedDate: date, setSelectedDate: setDate } = useInvoiceNavigation();
  const isHeader = variant === 'header';

  return (
    <DatePickerInput
      maxDate={new Date()}
      leftSection={<IconCalendar size={isHeader ? 16 : 20} />}
      value={date}
      onChange={(v) => v && setDate(v)}
      valueFormat="D MMMM YYYY, dddd"
      size={isHeader ? 'sm' : undefined}
      maw={isHeader ? 320 : 400}
      w={isHeader ? '100%' : undefined}
      styles={{
        input: {
          fontWeight: 700,
          fontSize: isHeader ? 'var(--mantine-font-size-md)' : 'var(--mantine-font-size-lg)',
          ...(isHeader ? {} : { boxShadow: 'var(--mantine-shadow-sm)' }),
        }
      }}
      popoverProps={{
        styles: {
          dropdown: {
            border: '1px solid var(--org-color, #228be6)',
            boxShadow: 'var(--mantine-shadow-md)',
          },
        },
      }}
      renderDay={(renderDate) => {
        const isToday = dayjs(renderDate).isSame(dayjs(), 'day');
        return (
          <div
            style={{
              ...(isToday && {
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '2px solid var(--mantine-primary-color-filled)',
              }),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

            }}
          >
            {dayjs(renderDate).date()}
          </div>
        );
      }}
    />
  );
}
