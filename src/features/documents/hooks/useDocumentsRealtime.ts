/** Realtime-синхронизация домена документов с кэшем React Query. */

import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { UnsubscribeFunc } from 'pocketbase';
import { pb } from '@/api/client';
import {
  DOCUMENT_COMMENTS_COLLECTION,
  DOCUMENT_FILES_COLLECTION,
  DOCUMENT_HISTORY_COLLECTION,
  DOCUMENTS_COLLECTION,
} from '@/features/documents/api/constants';
import { qTag } from '@/features/documents/api/shared';

/** Коллекции домена документов, изменения которых влияют на таблицу и карточку. */
const REALTIME_COLLECTIONS = [
  DOCUMENTS_COLLECTION,
  DOCUMENT_FILES_COLLECTION,
  DOCUMENT_COMMENTS_COLLECTION,
  DOCUMENT_HISTORY_COLLECTION,
] as const;

/** Корни query-ключей домена документов (список, архив, карточка, файлы, комментарии, история). */
const DOCUMENT_QUERY_ROOTS = new Set<string>([
  'documents',
  'documents-archive',
  'document',
  'document-files',
  'document-comments',
  'document-history',
  'document-source',
  'document-comment-search',
  'document-files-all',
  'document-comments-all',
]);

/** Сбрасывает кэш домена документов, чтобы таблица и карточка перечитали данные. */
export function invalidateDocumentsCache(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: (query) => DOCUMENT_QUERY_ROOTS.has(String(query.queryKey[0])),
  });
}

/**
 * Держит таблицу документов в актуальном состоянии при изменениях других пользователей.
 * Подписывается на коллекции домена организации и пакетно сбрасывает кэш React Query.
 */
export function useDocumentsRealtime(organizationId: string, enabled = true): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId || !enabled) return;

    // subscribe() асинхронен: размонтирование может произойти раньше резолва,
    // поэтому `disposed` освобождает поздние подписки.
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribes: UnsubscribeFunc[] = [];

    const release = (unsubscribe: UnsubscribeFunc) => {
      void unsubscribe().catch((err: unknown) => {
        console.error('Не удалось отписаться от документов в реальном времени', err);
      });
    };

    // Одно действие другого пользователя приходит пачкой событий
    // (файл → смена статуса → история), поэтому окно 250 мс схлопывает
    // её в один сброс кэша вместо нескольких перезагрузок списка.
    const scheduleInvalidate = () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (!disposed) invalidateDocumentsCache(queryClient);
      }, 250);
    };

    const filter = `organization_id = "${qTag(organizationId)}"`;

    const subscribe = async (collection: string) => {
      try {
        const unsubscribe = await pb
          .collection(collection)
          .subscribe('*', scheduleInvalidate, { filter });
        if (disposed) {
          release(unsubscribe);
          return;
        }
        unsubscribes.push(unsubscribe);
      } catch (err) {
        console.error(`Не удалось подписаться на realtime-изменения «${collection}»`, err);
      }
    };

    void Promise.all(REALTIME_COLLECTIONS.map(subscribe));

    return () => {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      for (const unsubscribe of unsubscribes) release(unsubscribe);
    };
  }, [organizationId, enabled, queryClient]);
}
