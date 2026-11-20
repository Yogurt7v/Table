import { Affix, Center, Loader, Paper, Skeleton, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { CollapsedObjectsProvider } from '@/shared/context/CollapsedObjectsContext';
import { useInvoiceNavigation } from '@/shared/context/InvoiceNavigationContext';
import { useSearch } from '@/shared/context/SearchContext';
import { formatAmountRub } from '@/shared/utils/format-currency';
import { normalizeRelationId } from '@/shared/utils/normalize-invoice';
import { InvoiceColumnSettingsModal } from '@/features/invoices/ui/invoice-column-settings-modal/InvoiceColumnSettingsModal';
import { PrintableInvoices } from '@/features/invoices/ui/printable-invoices/PrintableInvoices';
import { SearchResultsView } from '@/features/invoices/ui/search-results-view/SearchResultsView';
import { InvoiceSectionObjectsList } from '@/features/invoices/ui/invoice-section/InvoiceSectionObjectsList';
import { AutoExpandOnHighlight } from '@/features/invoices/ui/invoice-section/InvoiceSectionHighlight';
import { useInvoiceSection } from '@/features/invoices/ui/invoice-section/useInvoiceSection';
import { resolveInvoiceNavigationDay } from '@/features/invoices/utils/invoice-navigation-day';
import type { IInvoice } from '@/shared/types';

interface InvoiceSectionProps {
  orgId: string;
  date: string;
  searchAll: boolean;
  onBackToDate: () => void;
  bankTotal: number;
}

/**
 * Секция счетов за выбранную дату: список объектов с таблицами счетов,
 * поиск по всем счетам, печать/экспорт и подсветка строки из уведомления.
 */
export function InvoiceSection({
  orgId,
  date,
  searchAll,
  onBackToDate,
  bankTotal,
}: InvoiceSectionProps) {
  const page = useInvoiceSection({ orgId, date, searchAll, bankTotal });
  const { setSearchAll } = useSearch();
  const { requestHighlight } = useInvoiceNavigation();

  // Переход из результатов поиска к счёту: выходим из режима поиска и просим
  // подсветку на дне оплаты (если он доступен) либо на дате счёта.
  const handleOpenInvoice = (invoice: IInvoice) => {
    setSearchAll(false);
    const day = resolveInvoiceNavigationDay(invoice, page.permissions.canViewPaidDate);
    requestHighlight(invoice.id, dayjs(day).toDate());
  };

  if (!orgId) return null;

  if (!page.permissions.canView) return null;

  if (!page.objects)
    return (
      <Stack gap="sm" py="xs">
        <Skeleton height={32} radius="sm" />
        <Skeleton height={140} radius="md" />
        <Skeleton height={140} radius="md" />
      </Stack>
    );

  if (searchAll && page.searchResultsLoading) {
    return (
      <Paper withBorder p="xl">
        <Center py="xl">
          <Loader />
        </Center>
      </Paper>
    );
  }

  if (searchAll && page.searchResults) {
    return (
      <SearchResultsView
        searchText={page.debouncedSearchText}
        searchResults={page.searchResults}
        date={date}
        canViewPaidDate={page.permissions.canViewPaidDate}
        onBackToDate={onBackToDate}
        onOpenInvoice={handleOpenInvoice}
      />
    );
  }

  if (page.isPrinting) {
    const baseObjects = page.printingTarget === 'all' ? page.visibleObjects : page.objects;
    const printObjects = baseObjects.filter(
      (obj) => page.printingTarget === 'all' || obj.id === page.printingTarget,
    );
    const printInvoicesFiltered =
      page.printingTarget === 'all'
        ? page.printInvoices
        : page.printInvoices.filter(
            (inv) => normalizeRelationId(inv.accounting_object_id) === page.printingTarget,
          );
    return (
      <PrintableInvoices
        invoices={printInvoicesFiltered}
        objects={printObjects}
        date={date}
        visibleColumns={page.visibleColumns}
        paymentMarks={page.paymentMarks}
        canViewPaymentMarks={page.permissions.canViewPaymentMarks}
        canViewPaidDate={page.permissions.canViewPaidDate}
        usersMap={page.usersMap}
        role={page.permissions.role}
      />
    );
  }

  return (
    <>
      <CollapsedObjectsProvider orgId={orgId} objectIds={page.objectIds}>
        <AutoExpandOnHighlight
          highlightedInvoiceId={page.highlightedInvoiceId}
          highlightRequestId={page.highlightRequestId}
          highlightDateCandidates={page.highlightDateCandidates}
          objects={page.objects}
          invoices={page.displayInvoices}
        />
        <InvoiceSectionObjectsList
          orgId={orgId}
          date={date}
          objects={page.visibleObjects}
          hiddenObjects={page.hiddenObjects}
          allObjects={page.objects}
          invoices={page.displayInvoices}
          activeFilters={page.activeFilters}
          highlightedIds={page.highlightedIds}
          hasSearch={!!page.debouncedSearchText}
          draftObjectId={page.draftObjectId}
          permissions={{
            canCreate: page.permissions.canCreate,
            role: page.permissions.role,
          }}
          paymentMarks={page.paymentMarks}
          filesByInvoice={page.filesByInvoice}
          visibleColumns={page.visibleColumns}
          onOpenDraft={(id) => page.setDraftObjectId(id)}
          onCancelDraft={() => page.setDraftObjectId(null)}
          onPrint={(objId) => page.handlePrint(objId)}
          onExport={(objId) => page.handleExportExcel(objId)}
          onColumnSettingsClick={() => page.setColumnSettingsOpen(true)}
          onPrintAll={() => page.handlePrint()}
          onExportAll={() => page.handleExportExcel()}
          onActiveFiltersChange={page.setActiveFilters}
          paidTodayTotal={page.paidTodayTotal}
        />
      </CollapsedObjectsProvider>

      {/* Итоговая сумма по неоплаченным счетам */}
      {page.grandTotal > 0 && (
        <Paper withBorder p="md" mt="lg">
          <Text ta="right" fw={700} size="lg">
            ИТОГО: {formatAmountRub(page.grandTotal)}
          </Text>
        </Paper>
      )}

      <InvoiceColumnSettingsModal
        key={page.columnSettingsOpen ? 'open' : 'closed'}
        opened={page.columnSettingsOpen}
        value={page.visibleColumns}
        onChange={page.handleColumnChange}
        onClose={() => page.setColumnSettingsOpen(false)}
        role={page.permissions.role}
      />

      {/* Плавающая сумма к оплате по отметкам */}
      {page.permissions.canViewPaymentMarks && page.markedTotal > 0 && (
        <Affix position={{ bottom: 20, right: 20 }} zIndex={100}>
          <Paper withBorder p="sm" shadow="lg">
            <Text ta="right" fw={700} size="md" c={page.isOverBalance ? 'red' : undefined}>
              Итого к оплате: {formatAmountRub(page.markedTotal)}
            </Text>
          </Paper>
        </Affix>
      )}
    </>
  );
}
