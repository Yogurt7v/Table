import { useEffect, useRef, useState } from 'react';
import { useCollapsedObjects } from '@/shared/context/CollapsedObjectsContext';
import type { IAccountingObject } from '@/shared/types';

/**
 * Состояние списка объектов: сворачивание групп и раскрытие секции
 * «Объекты без счетов». При поиске всё разворачивается, а секция без
 * счетов автоматически раскрывается при появлении поиска.
 */
export function useInvoiceSectionObjectsList(
  objects: IAccountingObject[],
  hiddenObjects: IAccountingObject[],
  hasSearch: boolean,
) {
  const { collapsedIds, collapseAll, expand, expandAll } = useCollapsedObjects();
  const [hiddenOpen, setHiddenOpen] = useState(hasSearch);
  const allCollapsed =
    objects.length > 0 && !hiddenOpen && objects.every((o) => collapsedIds.has(o.id));
  const showCollapseButton = objects.length > 1 || (objects.length > 0 && hiddenObjects.length > 0);

  const prevHasSearchRef = useRef(hasSearch);

  // Поиск: раскрыть все объекты, чтобы найденные строки были видны.
  useEffect(() => {
    if (hasSearch) expandAll();
  }, [hasSearch, expandAll]);

  // При переходе «нет поиска → есть поиск» открыть секцию без счетов.
  useEffect(() => {
    if (hasSearch && !prevHasSearchRef.current) {
      setHiddenOpen(true);
    }
    prevHasSearchRef.current = hasSearch;
  }, [hasSearch]);

  const handleCollapseAll = () => {
    collapseAll();
    setHiddenOpen(false);
  };

  const handleExpandAll = () => {
    expand(objects.map((o) => o.id));
  };

  const toggleHiddenOpen = () => setHiddenOpen((v) => !v);

  return {
    hiddenOpen,
    allCollapsed,
    showCollapseButton,
    handleCollapseAll,
    handleExpandAll,
    toggleHiddenOpen,
  };
}
