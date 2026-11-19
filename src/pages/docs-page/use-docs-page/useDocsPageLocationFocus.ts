import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Location } from 'react-router-dom';
import type { IDocument } from '@/shared/types';
import type { DocumentStatusFilter } from '../docs-page-types';

interface UseDocsPageLocationFocusArgs {
  location: Location;
  documents: IDocument[] | undefined;
  isDocumentsLoaded: boolean;
  pageSize: number;
  sortOrder: 'new' | 'old' | null;
  setSearch: (value: string) => void;
  setStatusFilter: (value: DocumentStatusFilter | null) => void;
  setFilterObjectIds: (value: string[]) => void;
  setFilterPaymentDate: (value: string | null) => void;
  setFilterCounterparty: (value: string) => void;
  setPaymentDateRange: (value: [Date | null, Date | null]) => void;
  setInvoiceDateRange: (value: [Date | null, Date | null]) => void;
  setPages: Dispatch<SetStateAction<Record<string, number>>>;
  setCollapsedIds: Dispatch<SetStateAction<Set<string>>>;
  setHighlightDocumentId: (value: string | null) => void;
  scheduleHighlightFallback: () => void;
}

/** Обрабатывает переход к документу из location.state: сбрасывает фильтры, ищет страницу и включает подсветку. */
export function useDocsPageLocationFocus({
  location,
  documents,
  isDocumentsLoaded,
  pageSize,
  sortOrder,
  setSearch,
  setStatusFilter,
  setFilterObjectIds,
  setFilterPaymentDate,
  setFilterCounterparty,
  setPaymentDateRange,
  setInvoiceDateRange,
  setPages,
  setCollapsedIds,
  setHighlightDocumentId,
  scheduleHighlightFallback,
}: UseDocsPageLocationFocusArgs) {
  const handledLocationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isDocumentsLoaded) return;
    // Одна и та же навигация (location.key) обрабатывается только один раз.
    if (handledLocationKeyRef.current === location.key) return;
    handledLocationKeyRef.current = location.key;

    const state = (location.state ?? {}) as { documentId?: string };
    const documentId = state.documentId;
    if (!documentId) {
      queueMicrotask(() => setHighlightDocumentId(null));
      return;
    }

    queueMicrotask(() => {
      setSearch('');
      setStatusFilter(null);
      setFilterObjectIds([]);
      setFilterPaymentDate(null);
      setFilterCounterparty('');
      setPaymentDateRange([null, null]);
      setInvoiceDateRange([null, null]);

      const base = documents ?? [];
      const doc = base.find((d) => d.id === documentId);
      if (doc) {
        const objectId = doc.accounting_object_id;
        const groupDocs = base.filter((d) => d.accounting_object_id === objectId);
        if (sortOrder === 'new') {
          groupDocs.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''));
        } else if (sortOrder === 'old') {
          groupDocs.sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''));
        }
        const index = groupDocs.findIndex((d) => d.id === documentId);
        if (index >= 0) {
          const page = Math.floor(index / pageSize) + 1;
          setPages((prev) => ({ ...prev, [objectId]: page }));
        }
        setCollapsedIds((prev) => {
          if (!prev.has(objectId)) return prev;
          const next = new Set(prev);
          next.delete(objectId);
          return next;
        });
      }

      setHighlightDocumentId(documentId);
      scheduleHighlightFallback();
    });
  }, [
    location.state,
    location.key,
    documents,
    isDocumentsLoaded,
    pageSize,
    sortOrder,
    scheduleHighlightFallback,
    setFilterCounterparty,
    setFilterObjectIds,
    setFilterPaymentDate,
    setHighlightDocumentId,
    setInvoiceDateRange,
    setPages,
    setPaymentDateRange,
    setSearch,
    setStatusFilter,
    setCollapsedIds,
  ]);
}
