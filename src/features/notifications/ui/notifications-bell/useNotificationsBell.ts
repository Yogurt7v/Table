import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getDeletedInvoiceByOriginalId, getInvoice } from '@/api/collections';
import { useInvoiceNavigation } from '@/shared/context/InvoiceNavigationContext';
import { useOrg } from '@/shared/context/OrgContext';
import { useNotifications, useNotificationsByDate } from '@/shared/hooks/useNotifications';
import type { IInvoice, INotification } from '@/shared/types';

/**
 * Состояние и навигация колокольчика уведомлений: список, выбор дня в календаре
 * и переход к связанному счёту/документу (включая подсветку и архив).
 */
export function useNotificationsBell() {
  const [opened, setOpened] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState<Date>(() => dayjs().startOf('month').toDate());
  const { currentOrgId, setCurrentOrgId } = useOrg();
  const {
    notifications: items,
    isLoading,
    isLoadingMore,
    hasMore,
    unreadCount,
    error,
    retryNow,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const queryClient = useQueryClient();
  const { selectedDate, requestHighlight, requestHighlightWithCandidates } = useInvoiceNavigation();
  const navigate = useNavigate();

  const selectedDateStr = calendarDate ? dayjs(calendarDate).format('YYYY-MM-DD') : '';
  const { data: dateNotifications, isLoading: dateLoading } =
    useNotificationsByDate(selectedDateStr);

  // При выборе дня показываем уведомления этого дня: с сервера (если пришли)
  // или отфильтрованные из уже загруженного списка.
  const dayItems = useMemo(() => {
    if (!calendarDate) return null;
    const day = dayjs(calendarDate).format('YYYY-MM-DD');
    return items.filter((n) => dayjs(n.created).format('YYYY-MM-DD') === day);
  }, [calendarDate, items]);

  const usedNotifications = useMemo(() => {
    if (!calendarDate) return items;
    return dateNotifications ?? dayItems ?? [];
  }, [calendarDate, dateNotifications, dayItems, items]);

  const listLoading = calendarDate ? dateLoading : isLoading;

  // Отметку о прочтении делает вызывающий (`NotificationBlock.handleClick`) под тем же
  // условием `!read` — здесь она была бы вторым PATCH на тот же id из одного клика.
  const handleNavigate = useCallback(
    (n: INotification) => {
      setOpened(false);
      if (n.organization_id && n.organization_id !== currentOrgId) {
        setCurrentOrgId(n.organization_id);
      }
      if (!n.invoice_id && !n.document_id) return;

      if (n.document_id) {
        navigate('/docs', { state: { documentId: n.document_id } });
        return;
      }

      if (n.type === 'invoice_deleted') {
        if (!n.organization_id) {
          navigate('/admin?tab=archive');
          return;
        }
        getDeletedInvoiceByOriginalId(n.organization_id, n.invoice_id)
          .then((deleted) => {
            navigate(`/admin?tab=archive&highlight=${encodeURIComponent(deleted.id)}`);
          })
          .catch(() => {
            navigate('/admin?tab=archive');
          });
        return;
      }

      const todayStr = dayjs().format('YYYY-MM-DD');
      const currentDayStr = dayjs(selectedDate).format('YYYY-MM-DD');
      const notificationDay = n.created ? dayjs(n.created).format('YYYY-MM-DD') : todayStr;
      const orgId = n.organization_id ?? currentOrgId;

      getInvoice(n.invoice_id)
        .then((invoice) => {
          const invoiceDay = dayjs(invoice.date).format('YYYY-MM-DD');
          const currentInvoices =
            queryClient.getQueryData<IInvoice[]>(['invoices', orgId, currentDayStr]) ?? [];

          navigate('/');

          // 1) Счёт уже есть в текущем выбранном дне — подсветить без смены даты.
          if (currentInvoices.some((inv) => inv.id === invoice.id)) {
            requestHighlight(invoice.id, selectedDate);
            return;
          }

          // 2) Если не найден в текущем дне: старое уведомление -> день уведомления, затем день счёта;
          // сегодняшнее -> сегодня, затем день счёта.
          const candidates: string[] = [];
          const push = (d: string) => {
            if (d && !candidates.includes(d)) candidates.push(d);
          };
          if (notificationDay !== todayStr) {
            push(notificationDay);
            push(invoiceDay);
          } else {
            push(todayStr);
            push(invoiceDay);
          }

          if (candidates.length === 1) {
            requestHighlight(invoice.id, dayjs(candidates[0]).toDate());
            return;
          }
          requestHighlightWithCandidates(invoice.id, candidates);
        })
        .catch(() => {
          navigate('/');
          requestHighlight('', new Date());
        });
    },
    [
      currentOrgId,
      navigate,
      queryClient,
      requestHighlight,
      requestHighlightWithCandidates,
      selectedDate,
      setCurrentOrgId,
    ],
  );

  const open = useCallback(() => setOpened(true), []);
  const close = useCallback(() => setOpened(false), []);
  const clearDate = useCallback(() => setCalendarDate(null), []);
  const showToday = useCallback(() => {
    const today = dayjs().startOf('day').toDate();
    setCalendarDate(today);
    setViewDate(today);
  }, []);

  return {
    opened,
    open,
    close,
    calendarDate,
    setCalendarDate,
    viewDate,
    setViewDate,
    clearDate,
    showToday,
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    unreadCount,
    error,
    retryNow,
    loadMore,
    markAsRead,
    markAllAsRead,
    usedNotifications,
    listLoading,
    handleNavigate,
  };
}

export type NotificationsBellModel = ReturnType<typeof useNotificationsBell>;
