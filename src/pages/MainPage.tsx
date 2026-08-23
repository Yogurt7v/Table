import { useState } from 'react';
import { Container, Stack, Loader, Paper, Text, Button } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useOrg } from '@/shared/context/OrgContext';
import { useAuth } from '@/shared/context/AuthContext';
import { useSearch } from '@/shared/context/SearchContext';
import { useBankAccounts } from '@/shared/hooks/useBankAccounts';
import { AccountList } from '@/features/accounts/AccountList';
import { InvoiceSection } from '@/features/invoices/InvoiceSection';

export function MainPage() {
  const { currentOrgId, organizationsLoading } = useOrg();
  const { logout } = useAuth();
  const { searchText, searchAll, setSearchAll } = useSearch();
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = dayjs(date).format('YYYY-MM-DD');

  const { data: accounts, isLoading: accountsLoading } = useBankAccounts(currentOrgId, dateStr);

  if (!currentOrgId) {
    if (organizationsLoading) return <Loader />;
    return (
      <Container size="sm" py="xl">
        <Paper withBorder p="xl" ta="center">
          <Text mb="md">Вас не добавили ни в одну организацию.</Text>
          <Text c="dimmed" mb="lg" size="sm">
            Обратитесь к администратору, чтобы получить доступ.
          </Text>
          <Button variant="default" onClick={() => logout()}>
            Выйти
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="fluid" py="md">
      <Stack gap="lg">
        <DatePickerInput
          maxDate={new Date()}
          leftSection={<IconCalendar size={20} />}
          value={date}
          onChange={(v) => v && setDate(v)}
          valueFormat="D MMMM YYYY, dddd"
          w={{ base: '100%', sm: 320 }}
          maw={320}
          styles={{
            input: {
              fontWeight: 'bold',
              fontSize: '1.1rem', // или '18px', '1.2em' и т.д.
            },
          }}
          renderDay={(renderDate) => {
            const isToday = dayjs(renderDate).isSame(dayjs(), 'day');
            return (
              <div
                style={{
                  ...(isToday && {
                    width: 28,
                    height: 28,
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
