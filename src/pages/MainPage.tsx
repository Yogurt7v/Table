import { useState } from 'react';
import { Container, Stack, Loader } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useOrg } from '@/shared/context/OrgContext';
import { useSearch } from '@/shared/context/SearchContext';
import { useBankAccounts } from '@/shared/hooks/useBankAccounts';
import { AccountList } from '@/features/accounts/AccountList';
import { InvoiceSection } from '@/features/invoices/InvoiceSection';

export function MainPage() {
  const { currentOrgId } = useOrg();
  const { searchText, searchAll, setSearchAll } = useSearch();
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = dayjs(date).format('YYYY-MM-DD');

  const { data: accounts, isLoading: accountsLoading } = useBankAccounts(currentOrgId, dateStr);

  if (!currentOrgId) return <Loader />;

  return (
    <Container size="fluid" py="md">
      <Stack gap="lg">
        <DatePickerInput
          leftSection={<IconCalendar size={20} />}
          value={date}
          onChange={(v) => v && setDate(v)}
          w={280}
          styles={{
          input: {
            fontWeight: 'bold',
            fontSize: '1.1rem', // или '18px', '1.2em' и т.д.
          },
        }}
        />

        <AccountList accounts={accounts} loading={accountsLoading} date={dateStr} />

        <InvoiceSection
          orgId={currentOrgId}
          date={dateStr}
          searchText={searchText}
          searchAll={searchAll}
          onBackToDate={() => setSearchAll(false)}
          bankTotal={accounts?.reduce((s, a) => s + a.balance, 0) ?? 0}
        />
      </Stack>
    </Container>
  );
}
