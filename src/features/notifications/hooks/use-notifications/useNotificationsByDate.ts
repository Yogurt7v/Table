/** Хук загрузки уведомлений пользователя за конкретную дату. */

import { useQuery } from '@tanstack/react-query';
import { getNotificationsByDate } from '@/api/collections';
import { useAuth } from '@/shared/context/AuthContext';

/** Загружает уведомления текущего пользователя за указанную дату. */
export function useNotificationsByDate(date: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notificationsByDate', user?.id, date],
    queryFn: () => getNotificationsByDate(user!.id, date),
    enabled: !!user && !!date,
  });
}
