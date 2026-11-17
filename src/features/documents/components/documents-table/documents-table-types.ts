import type { DocumentColumnId, IDocument, IDocumentComment, IDocumentFile } from '@/shared/types';
import type { DocumentColumnSizing } from '@/features/documents/document-columns';

/** Группа документов одного объекта учёта: заголовок, страница и общая длина. */
export interface DocumentGroup {
  objectId: string;
  objectName: string;
  documents: IDocument[];
  total: number;
  page: number;
}

/** Данные, общие для всех групп таблицы документов. */
export interface DocumentsTableData {
  /** Состав видимых колонок в порядке отображения. */
  visibleColumns: DocumentColumnId[];
  /** Ширины колонок: id -> ширина. */
  sizing: DocumentColumnSizing;
  /** Файлы по id документа. */
  filesByDocument: Record<string, IDocumentFile[]>;
  /** Комментарии по id документа. */
  commentsByDocument: Record<string, IDocumentComment[]>;
  /** Документ, который нужно подсветить (переход из другого реестра). */
  highlightDocumentId?: string | null;
  /** Указатель на строку подсвеченного документа — для прокрутки к ней. */
  highlightRowRef?: (node: HTMLTableRowElement | null) => void;
}

/** Обработчики таблицы документов. */
export interface DocumentsTableHandlers {
  onToggleCollapse: (objectId: string) => void;
  onPageChange: (objectId: string, page: number) => void;
  onWidthChange: (columnId: DocumentColumnId, width: number) => void;
  onWidthCommit: () => void;
  onOpenDocument: (document: IDocument, tab?: 'document' | 'files' | 'comments') => void;
}
