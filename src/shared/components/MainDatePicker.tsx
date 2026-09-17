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
  const isPage = variant === 'page';

  return (
    <DatePickerInput
      maxDate={new Date()}
      leftSection={<IconCalendar size={isHeader ? 16 : 20} />}
      value={date}
      onChange={(v) => v && setDate(v)}
      valueFormat="D MMMM YYYY, dddd"
      size={isHeader ? 'sm' : undefined}
      maw={isPage ? { base: '100%', sm: 400 } : 320}
      w={isPage ? { base: '100%', sm: 'auto' } : '100%'}
      styles={{
        input: {
          fontWeight: 700,
          fontSize: isHeader
            ? 'var(--mantine-font-size-md)'
            : { base: 'var(--mantine-font-size-md)', sm: 'var(--mantine-font-size-lg)' },
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          ...(isPage ? { boxShadow: 'var(--mantine-shadow-sm)' } : {}),
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
