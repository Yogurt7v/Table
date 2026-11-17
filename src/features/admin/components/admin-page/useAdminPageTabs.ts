import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

/** Параметры вкладок страницы администрирования. */
export interface UseAdminPageTabsParams {
  canViewMailArchive: boolean;
}

/**
 * Вкладки страницы администрирования.
 * Активная вкладка берётся из `?tab=`; неизвестное значение оставляет панели
 * скрытыми, а вкладка архива писем без прав откатывается на «Организации».
 * Подсветка передаётся из `?highlight=` и снимается после обработки.
 */
export function useAdminPageTabs({ canViewMailArchive }: UseAdminPageTabsParams) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const requestedTab = searchParams.get('tab') ?? 'organizations';
  const activeTab =
    requestedTab === 'mail-archive' && !canViewMailArchive ? 'organizations' : requestedTab;
  const highlightDeletedId = searchParams.get('highlight') || null;

  /** Переключает вкладку, записывая её в адрес и обновляя данные архивов. */
  const handleTabChange = (value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('tab', value);
    else next.delete('tab');
    setSearchParams(next, { replace: true });
    if (value === 'archive') {
      queryClient.invalidateQueries({ queryKey: ['deleted_invoices'] });
    }
    if (value === 'mail-archive') {
      queryClient.invalidateQueries({ queryKey: ['deletedIncomingMails'] });
      queryClient.invalidateQueries({ queryKey: ['deletedOutgoingMails'] });
    }
    if (value === 'documents-archive') {
      queryClient.invalidateQueries({ queryKey: ['documents-archive'] });
    }
  };

  /** Убирает `highlight` из адреса, сохраняя остальные параметры. */
  const clearHighlightParam = () => {
    if (!searchParams.has('highlight')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('highlight');
    setSearchParams(next, { replace: true });
  };

  return { activeTab, highlightDeletedId, handleTabChange, clearHighlightParam };
}
