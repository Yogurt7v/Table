import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type { IAccountingObject, IDocument, IDocumentComment, IDocumentFile } from '@/shared/types';
import type { DocumentGroup } from '@/features/documents/DocumentsTable';
import { isDocumentCompleted } from '@/features/documents/model/document-columns';
import { localDateToDateKey } from '@/features/mail/mail-date';
import { foldSearchText, matchesFolded } from '@/shared/utils/search-text';
import type { DocumentStatusFilter } from './docs-page-types';

interface UseDocsPageDerivedArgs {
  currentOrgId: string | null;
  accessibleObjects: IAccountingObject[] | undefined;
  documentsData: IDocument[] | undefined;
  filesData: IDocumentFile[] | undefined;
  commentsData: IDocumentComment[] | undefined;
  debouncedSearch: string;
  filterCounterparty: string;
  matchingCommentIds: Set<string>;
  statusFilter: DocumentStatusFilter | null;
  filterObjectIds: string[];
  filterPaymentDate: string | null;
  paymentDateRange: [Date | null, Date | null];
  invoiceDateRange: [Date | null, Date | null];
  invoiceDateById: Record<string, string>;
  sortOrder: 'new' | 'old' | null;
  pageSize: number;
  pages: Record<string, number>;
  setStatusFilter: (value: DocumentStatusFilter | null) => void;
  setSortOrder: (value: 'new' | 'old' | null) => void;
  setFilterObjectIds: (value: string[]) => void;
  setFilterPaymentDate: (value: string | null) => void;
  setFilterCounterparty: (value: string) => void;
  setPaymentDateRange: (value: [Date | null, Date | null]) => void;
  setInvoiceDateRange: (value: [Date | null, Date | null]) => void;
  setPages: Dispatch<SetStateAction<Record<string, number>>>;
}

/** Вычисляет производные данные страницы документов: фильтрацию, группировку и карты файлов/комментариев. */
export function useDocsPageDerived({
  currentOrgId,
  accessibleObjects,
  documentsData,
  filesData,
  commentsData,
  debouncedSearch,
  filterCounterparty,
  matchingCommentIds,
  statusFilter,
  filterObjectIds,
  filterPaymentDate,
  paymentDateRange,
  invoiceDateRange,
  invoiceDateById,
  sortOrder,
  pageSize,
  pages,
  setStatusFilter,
  setSortOrder,
  setFilterObjectIds,
  setFilterPaymentDate,
  setFilterCounterparty,
  setPaymentDateRange,
  setInvoiceDateRange,
  setPages,
}: UseDocsPageDerivedArgs) {
  const objects = useMemo<IAccountingObject[]>(() => {
    if (!currentOrgId) return [];
    return [...(accessibleObjects ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [accessibleObjects, currentOrgId]);

  const objectOptions = useMemo(
    () => objects.map((object) => ({ value: object.id, label: object.name })),
    [objects],
  );

  const allowedObjectIds = useMemo(() => new Set(objects.map((object) => object.id)), [objects]);

  const activeFilterCount =
    (filterObjectIds.length > 0 ? 1 : 0) +
    (filterPaymentDate ? 1 : 0) +
    (filterCounterparty.trim() ? 1 : 0) +
    (paymentDateRange[0] || paymentDateRange[1] ? 1 : 0) +
    (invoiceDateRange[0] || invoiceDateRange[1] ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (sortOrder ? 1 : 0);

  /** Сбрасывает все фильтры и пагинацию по объектам. */
  const resetFilters = () => {
    setStatusFilter(null);
    setSortOrder(null);
    setFilterObjectIds([]);
    setFilterPaymentDate(null);
    setFilterCounterparty('');
    setPaymentDateRange([null, null]);
    setInvoiceDateRange([null, null]);
    setPages({});
  };

  const filesByDocument = useMemo(() => {
    const map: Record<string, IDocumentFile[]> = {};
    for (const file of filesData ?? []) {
      (map[file.document_id] ??= []).push(file);
    }
    return map;
  }, [filesData]);

  const commentsByDocument = useMemo(() => {
    const map: Record<string, IDocumentComment[]> = {};
    for (const comment of commentsData ?? []) {
      (map[comment.document_id] ??= []).push(comment);
    }
    return map;
  }, [commentsData]);

  const foldedQuery = foldSearchText(debouncedSearch);
  const foldedCounterparty = foldSearchText(filterCounterparty);

  const visibleDocuments = useMemo(() => {
    return (documentsData ?? []).filter((document) => {
      if (document.is_deleted) return false;
      if (statusFilter) {
        if (statusFilter === 'in_progress') {
          if (document.provided || document.confirmed) return false;
        } else if (statusFilter === 'provided') {
          if (!document.provided || document.confirmed) return false;
        } else if (statusFilter === 'confirmed') {
          if (!isDocumentCompleted(document)) return false;
        }
      }
      if (!allowedObjectIds.has(document.accounting_object_id)) return false;
      if (filterObjectIds.length > 0 && !filterObjectIds.includes(document.accounting_object_id)) {
        return false;
      }
      if (filterPaymentDate && document.payment_date !== filterPaymentDate) return false;
      if (
        foldedCounterparty &&
        !foldSearchText(document.counterparty).includes(foldedCounterparty)
      ) {
        return false;
      }
      const paymentKey = document.payment_date ? document.payment_date.slice(0, 10) : '';
      const paymentFrom = localDateToDateKey(paymentDateRange[0]);
      const paymentTo = localDateToDateKey(paymentDateRange[1]);
      if (paymentFrom && paymentKey < paymentFrom) return false;
      if (paymentTo && paymentKey > paymentTo) return false;
      const invoiceKey = document.source_invoice_id
        ? (invoiceDateById[document.source_invoice_id] ?? '')
        : '';
      const invoiceFrom = localDateToDateKey(invoiceDateRange[0]);
      const invoiceTo = localDateToDateKey(invoiceDateRange[1]);
      if ((invoiceFrom || invoiceTo) && !invoiceKey) return false;
      if (invoiceFrom && invoiceKey < invoiceFrom) return false;
      if (invoiceTo && invoiceKey > invoiceTo) return false;
      if (!foldedQuery) return true;
      return (
        matchesFolded(
          [
            document.counterparty,
            document.purpose,
            document.contract_no,
            document.invoice_no,
            document.amount != null ? String(document.amount) : '',
          ],
          foldedQuery,
        ) || matchingCommentIds.has(document.id)
      );
    });
  }, [
    documentsData,
    foldedQuery,
    foldedCounterparty,
    matchingCommentIds,
    statusFilter,
    allowedObjectIds,
    filterObjectIds,
    filterPaymentDate,
    paymentDateRange,
    invoiceDateRange,
    invoiceDateById,
  ]);

  const groups = useMemo<DocumentGroup[]>(() => {
    return objects
      .map((object) => {
        const objectDocuments = [...visibleDocuments]
          .filter((document) => document.accounting_object_id === object.id)
          .sort((a, b) => {
            if (sortOrder === 'new') {
              return (b.created ?? '').localeCompare(a.created ?? '');
            }
            if (sortOrder === 'old') {
              return (a.created ?? '').localeCompare(b.created ?? '');
            }
            return 0;
          });
        const totalPages = Math.max(1, Math.ceil(objectDocuments.length / pageSize));
        const page = Math.min(pages[object.id] ?? 1, totalPages);
        return {
          objectId: object.id,
          objectName: object.name,
          total: objectDocuments.length,
          page,
          documents: objectDocuments.slice((page - 1) * pageSize, page * pageSize),
        };
      })
      .filter((group) => group.total > 0);
  }, [visibleDocuments, objects, pageSize, pages, sortOrder]);

  return {
    objects,
    objectOptions,
    activeFilterCount,
    resetFilters,
    filesByDocument,
    commentsByDocument,
    visibleDocuments,
    groups,
  };
}
