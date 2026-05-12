import { useState } from 'react';
import { Container, Stack, Loader } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useOrg } from '@/shared/context/OrgContext';
import { useSearch } from '@/shared/context/SearchContext';
import { useBankAccounts } from '@/shared/hooks/useBankAccounts';
import { useInvoices } from '@/shared/hooks/useInvoices';
import { AccountList } from '@/features/accounts/AccountList';
import { InvoiceSection } from '@/features/invoices/InvoiceSection';

export function MainPage() {
  const { currentOrgId } = useOrg();
  const { searchText, searchAll, setSearchAll } = useSearch();
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = dayjs(date).format('YYYY-MM-DD');

  const { data: accounts, isLoading: accountsLoading } = useBankAccounts(currentOrgId);
  const { data: invoices } = useInvoices(currentOrgId, dateStr);

  if (!currentOrgId) return <Loader />;

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <DatePickerInput
          leftSection={<IconCalendar size={16} />}
          value={date}
          onChange={(v) => v && setDate(v)}
          w={280}
        />

        <AccountList accounts={accounts} loading={accountsLoading} />

        <InvoiceSection
          orgId={currentOrgId}
          date={dateStr}
          searchText={searchText}
          searchAll={searchAll}
          onBackToDate={() => setSearchAll(false)}
        />
      </Stack>
    </Container>
  );
}
