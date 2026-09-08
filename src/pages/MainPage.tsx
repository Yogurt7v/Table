import { Container, Stack, Loader, Paper, Text, Button, Center } from '@mantine/core';
import dayjs from 'dayjs';
import { useOrg } from '@/shared/context/OrgContext';
import { useAuth } from '@/shared/context/AuthContext';
import { useSearch } from '@/shared/context/SearchContext';
import { useInvoiceNavigation } from '@/shared/context/InvoiceNavigationContext';
import { useDatePinned } from '@/shared/context/DatePinnedContext';
import { useBankAccounts } from '@/shared/hooks/useBankAccounts';
import { MainDatePicker } from '@/shared/components/MainDatePicker';
import { AccountList } from '@/features/accounts/AccountList';
import { InvoiceSection } from '@/features/invoices/InvoiceSection';

export function MainPage() {
  const { currentOrgId, organizationsLoading } = useOrg();
  const { logout } = useAuth();
  const { searchAll, setSearchAll } = useSearch();
  const { selectedDate: date } = useInvoiceNavigation();
  const { pinned, registerAnchor } = useDatePinned();
  const dateStr = dayjs(date).format('YYYY-MM-DD');

  const { data: accounts, isLoading: accountsLoading } = useBankAccounts(currentOrgId, dateStr);

  if (!currentOrgId) {
    if (organizationsLoading)
      return (
        <Center py="xl">
          <Loader />
        </Center>
      );
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
        <div ref={registerAnchor} className="main-date-picker-page">
          <div
            className={
              pinned
                ? 'date-pinned-page-calendar date-pinned-page-calendar--off'
                : 'date-pinned-page-calendar'
            }
          >
            <MainDatePicker variant="page" />
          </div>
        </div>

        <AccountList accounts={accounts} loading={accountsLoading} date={dateStr} />

        <InvoiceSection
          orgId={currentOrgId}
          date={dateStr}
          searchAll={searchAll}
          onBackToDate={() => setSearchAll(false)}
          bankTotal={accounts?.reduce((s, a) => s + a.balance, 0) ?? 0}
        />
      </Stack>
    </Container>
  );
}
