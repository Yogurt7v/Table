import {
  CollapseToggle,
  CreateButton,
  DateRangePickers,
  FilterMenu,
  SearchAndPageSize,
} from './toolbar';
import type { DocsPageToolbarProps } from './DocsPageToolbarProps';

/** Панель управления страницы документов: периоды, поиск, фильтры и действия. */
export function DocsPageToolbar(props: DocsPageToolbarProps) {
  return (
    <>
      {/* Периоды фильтрации по датам оплаты и счёта */}
      <DateRangePickers
        paymentDateRange={props.paymentDateRange}
        invoiceDateRange={props.invoiceDateRange}
        onPaymentDateRangeChange={props.onPaymentDateRangeChange}
        onInvoiceDateRangeChange={props.onInvoiceDateRangeChange}
        setPages={props.setPages}
      />

      {/* Поиск и размер страницы */}
      <SearchAndPageSize
        search={props.search}
        onSearchChange={props.onSearchChange}
        onClearSearch={props.onClearSearch}
        pageSize={props.pageSize}
        onPageSizeChange={props.onPageSizeChange}
        setPages={props.setPages}
      />

      {/* Фильтры, сворачивание групп и создание документа */}
      <FilterMenu
        filterRef={props.filterRef}
        filterOpened={props.filterOpened}
        setFilterOpened={props.setFilterOpened}
        activeFilterCount={props.activeFilterCount}
        sortOrder={props.sortOrder}
        setSortOrder={props.setSortOrder}
        statusFilter={props.statusFilter}
        setStatusFilter={props.setStatusFilter}
        counterpartyOptions={props.counterpartyOptions}
        filterCounterparty={props.filterCounterparty}
        setFilterCounterparty={props.setFilterCounterparty}
        objects={props.objects}
        objectOptions={props.objectOptions}
        filterObjectIds={props.filterObjectIds}
        setFilterObjectIds={props.setFilterObjectIds}
        resetFilters={props.resetFilters}
        setPages={props.setPages}
      />
      <CollapseToggle
        collapsedAll={props.collapsedAll}
        onToggleCollapseAll={props.onToggleCollapseAll}
      />
      <CreateButton canCreate={props.canCreate} onCreate={props.onCreate} />
    </>
  );
}
