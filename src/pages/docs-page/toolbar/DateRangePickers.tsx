import { Group } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconFilter } from '@tabler/icons-react';

interface DateRangePickersProps {
  paymentDateRange: [Date | null, Date | null];
  invoiceDateRange: [Date | null, Date | null];
  onPaymentDateRangeChange: (value: [Date | null, Date | null]) => void;
  onInvoiceDateRangeChange: (value: [Date | null, Date | null]) => void;
  setPages: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

/** Два диапазона дат: период оплаты и период счёта. */
export function DateRangePickers({
  paymentDateRange,
  invoiceDateRange,
  onPaymentDateRangeChange,
  onInvoiceDateRangeChange,
  setPages,
}: DateRangePickersProps) {
  return (
    <Group gap="xs" wrap="wrap" onMouseDown={(e) => e.stopPropagation()}>
      <DatePickerInput
        type="range"
        size="xs"
        label="Период оплаты"
        placeholder="Период"
        aria-label="Период оплаты"
        clearable
        closeOnChange
        allowSingleDateInRange
        valueFormat="DD.MM.YYYY"
        labelSeparator=" – "
        leftSection={<IconFilter size={14} />}
        leftSectionPointerEvents="none"
        value={paymentDateRange}
        popoverProps={{ classNames: { dropdown: 'docs-period-dropdown' } }}
        onChange={(value: [Date | null, Date | null]) => {
          onPaymentDateRangeChange([value[0] ?? null, value[1] ?? null]);
          setPages({});
        }}
      />
      <DatePickerInput
        type="range"
        size="xs"
        label="Период счёта"
        placeholder="Период"
        aria-label="Период счёта"
        clearable
        closeOnChange
        allowSingleDateInRange
        valueFormat="DD.MM.YYYY"
        labelSeparator=" – "
        leftSection={<IconFilter size={14} />}
        leftSectionPointerEvents="none"
        value={invoiceDateRange}
        popoverProps={{ classNames: { dropdown: 'docs-period-dropdown' } }}
        onChange={(value: [Date | null, Date | null]) => {
          onInvoiceDateRangeChange([value[0] ?? null, value[1] ?? null]);
          setPages({});
        }}
      />
    </Group>
  );
}
